import $ from 'jquery';
import {Vector2} from 'three';
import {WallTypes} from '../core/constants.js';
import {Utils} from '../core/utils.js';
import {EVENT_UPDATED} from '../core/events.js';

import {Dimensioning} from '../core/dimensioning.js';
import {Configuration, configWallThickness, wallInformation} from '../core/configuration.js';
import {CarbonSheet} from './carbonsheet.js';

/** */
export const floorplannerModes = {MOVE: 0,DRAW: 1,DELETE: 2};

// grid parameters
export const gridSpacing = Dimensioning.cmToPixel(25);//20; // pixels
export const gridWidth = 1;
export const gridColor = '#f1f1f1';

// room config
// export const roomColor = '#f9f9f9';
export const roomColor = '#fedaff66';
export const roomColorHover = '#008cba66';
export const roomColorSelected = '#00ba8c66';

// wall config
export var wallWidth = 5;
export var wallWidthHover = 7;
export var wallWidthSelected = 9;
export const wallColor = '#dddddd';
export const wallColorHover = '#008cba';
export const wallColorSelected = '#00ba8c';

export const edgeColor = '#888888';
export const edgeColorHover = '#008cba';
export const edgeWidth = 1;

export const deleteColor = '#ff0000';

// corner config
export const cornerRadius = 3;
export const cornerRadiusHover = 6;
export const cornerRadiusSelected = 9;
export const cornerColor = '#cccccc';
export const cornerColorHover = '#008cba';
export const cornerColorSelected = '#00ba8c';
/**
 * The View to be used by a Floorplanner to render in/interact with.
 */
export class FloorplannerView2D
{
	constructor(floorplan, viewmodel, canvas)
	{
		this.canvasElement = document.getElementById(canvas);
		this.canvas = canvas;
		this.context = this.canvasElement.getContext('2d');
		this.floorplan = floorplan;
		this.viewmodel = viewmodel;

		var scope = this;
		this._carbonsheet = new CarbonSheet(floorplan, viewmodel, canvas);
		this._carbonsheet.addEventListener(EVENT_UPDATED, function()
				{
					scope.draw();
				});

		this.floorplan.carbonSheet = this._carbonsheet;

		$(window).resize(() => {scope.handleWindowResize();});
		this.handleWindowResize();
	}

	get carbonSheet()
	{
		return this._carbonsheet;
	}

	/** */
	handleWindowResize()
	{
		var canvasSel = $('#' + this.canvas);
		var parent = canvasSel.parent();
		canvasSel.height(parent.innerHeight());
		canvasSel.width(parent.innerWidth());
		this.canvasElement.height = parent.innerHeight();
		this.canvasElement.width = parent.innerWidth();
		this.draw();
	}

	/** */
	draw()
	{
		wallWidth = Dimensioning.cmToPixel(Configuration.getNumericValue(configWallThickness));
		wallWidthHover = Dimensioning.cmToPixel(Configuration.getNumericValue(configWallThickness))*0.7;
		wallWidthSelected = Dimensioning.cmToPixel(Configuration.getNumericValue(configWallThickness))*0.9;
		
		this.context.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

		this._carbonsheet.draw();
		this.drawGrid();
		this.drawOriginCrossHair();

		// this.context.globalAlpha = 0.3;
		this.floorplan.getRooms().forEach((room) => {this.drawRoom(room);});
		// this.context.globalAlpha = 1.0;

		this.floorplan.getWalls().forEach((wall) => {this.drawWall(wall);});
		this.floorplan.getCorners().forEach((corner) => {this.drawCorner(corner);});
		if (this.viewmodel.mode == floorplannerModes.DRAW)
		{
			this.drawTarget(this.viewmodel.targetX, this.viewmodel.targetY, this.viewmodel.lastNode);
			//Enable the below lines for measurement while drawing, still needs work as it is crashing the whole thing
			if(this.viewmodel.lastNode != null)
			{
				var a = new Vector2(this.viewmodel.lastNode.x,this.viewmodel.lastNode.y);
				var b = new Vector2(this.viewmodel.targetX, this.viewmodel.targetY);
				var abvector = b.clone().sub(a);
				var midPoint = abvector.multiplyScalar(0.5).add(a);
				this.drawTextLabel(Dimensioning.cmToMeasure(a.distanceTo(b)), this.viewmodel.convertX(midPoint.x), this.viewmodel.convertY(midPoint.y));
			}
		}
		this.floorplan.getWalls().forEach((wall) => {this.drawWallLabels(wall);});
		if(this.viewmodel._clickedWallControl != null)
		{
			this.drawCircle(this.viewmodel.convertX(this.viewmodel._clickedWallControl.x), this.viewmodel.convertY(this.viewmodel._clickedWallControl.y), 7, '#F7F7F7');
		}
	}

	drawOriginCrossHair()
	{
		var ox = this.viewmodel.convertX(0);
		var oy = this.viewmodel.convertY(0);
		
		//draw origin crosshair
		this.context.fillStyle = '#0000FF';
		this.context.fillRect(ox-2, oy-7.5, 4, 15);
		this.context.fillRect(ox-7.5, oy-2, 15, 4);
		this.context.strokeStyle = '#FF0000';
		this.context.fillRect(ox-1.25, oy-5, 2.5, 10);
		this.context.fillRect(ox-5, oy-1.25, 10, 2.5);
	}

	/** */
	drawWallLabels(wall)
	{
		// we'll just draw the shorter label... idk
		if (wall.backEdge && wall.frontEdge)
		{
			if (wall.backEdge.interiorDistance() < wall.frontEdge.interiorDistance())
			{
				this.drawEdgeLabel(wall.backEdge);
				this.drawEdgeLabelExterior(wall.backEdge);
			}
			else
			{
				this.drawEdgeLabel(wall.frontEdge);
				this.drawEdgeLabelExterior(wall.frontEdge);
			}
		}
		else if (wall.backEdge)
		{
			this.drawEdgeLabel(wall.backEdge);
			this.drawEdgeLabelExterior(wall.backEdge);
		}
		else if (wall.frontEdge)
		{
			this.drawEdgeLabel(wall.frontEdge);
			this.drawEdgeLabelExterior(wall.frontEdge);
		}
		this.drawWallLabelsMiddle(wall);
	}

	drawWallLabelsMiddle(wall)
	{
		if(! wallInformation.midline)
		{
			return;
		}
		var pos = wall.wallCenter();
		var length = wall.wallLength();
		if (length < 60)
		{
			// dont draw labels on walls this short
			return;
		}
		var label = (!wallInformation.labels)?'':wallInformation.midlinelabel;
		this.drawTextLabel(`${label}${Dimensioning.cmToMeasure(length)}` ,this.viewmodel.convertX(pos.x),this.viewmodel.convertY(pos.y));
	}

	/** */
	drawEdgeLabelExterior(edge)
	{
		var pos = edge.exteriorCenter();
		var length = edge.exteriorDistance();
		if (length < 60)
		{
			// dont draw labels on walls this short
			return;
		}
		if(wallInformation.exterior)
		{
			var label = (!wallInformation.labels)?'':wallInformation.exteriorlabel;
			this.drawTextLabel(`${label}${Dimensioning.cmToMeasure(length)}` ,this.viewmodel.convertX(pos.x),this.viewmodel.convertY(pos.y+40));
		}
	}

	/** */
	drawEdgeLabel(edge)
	{
		var pos = edge.interiorCenter();
		var length = edge.interiorDistance();
		if (length < 60)
		{
			// dont draw labels on walls this short
			return;
		}
		if(wallInformation.interior)
		{
			var label = (!wallInformation.labels)?'':wallInformation.interiorlabel;
			this.drawTextLabel(`${label}${Dimensioning.cmToMeasure(length)}` ,this.viewmodel.convertX(pos.x),this.viewmodel.convertY(pos.y-40));
		}
		
	}

	drawTextLabel(label, x, y, textcolor='#000000', strokecolor='#ffffff', style='normal')
	{
		this.context.font = `${style} 12px Arial`;
		this.context.fillStyle = textcolor;
		this.context.textBaseline = 'middle';
		this.context.textAlign = 'center';
		this.context.strokeStyle = strokecolor;
		this.context.lineWidth = 4;
		this.context.strokeText(label,x,y);
		this.context.fillText(label,x,y);
	}

	/** */
	drawEdge(edge, hover, curved=false)
	{
		var color = edgeColor;
		if (hover && this.viewmodel.mode == floorplannerModes.DELETE)
		{
			color = deleteColor;
		}
		else if (hover)
		{
			color = edgeColorHover;
		}
		var corners = edge.corners();
		var scope = this;
		if(!curved)
		{
			this.drawPolygon(
					Utils.map(corners, function (corner) 
					{
						return scope.viewmodel.convertX(corner.x);
					}),
					Utils.map(corners, function (corner) 
							{
								return scope.viewmodel.convertY(corner.y);
							}),false,null,true,color,edgeWidth);
		}
//		else
//		{
//			this.drawPolygonCurved(edge.curvedCorners(),false,null,true,color,edgeWidth);
//		}
		
	}
	
	/** */
	drawWall(wall)
	{
		var selected = (wall === this.viewmodel.selectedWall);
		var hover = (wall === this.viewmodel.activeWall && wall != this.viewmodel.selectedWall);
		var color = wallColor;
		
		if (hover && this.viewmodel.mode == floorplannerModes.DELETE)
		{
			color = deleteColor;
		}				
		else if (hover)
		{
			color = wallColorHover;
		}
		
		else if(selected)
		{
			color = wallColorSelected;
		}
		var isCurved = (wall.wallType == WallTypes.CURVED);
		if(wall.wallType == WallTypes.CURVED && selected)
		{
//			this.drawCircle(this.viewmodel.convertX(wall.start.x), this.viewmodel.convertY(wall.start.y), 10, '#AAAAAA');
//			this.drawCircle(this.viewmodel.convertX(wall.end.x), this.viewmodel.convertY(wall.end.y), 10, '#000000');
			
//			this.drawCircle(this.viewmodel.convertX(wall.a.x), this.viewmodel.convertY(wall.a.y), 10, '#ff8cd3');
//			this.drawCircle(this.viewmodel.convertX(wall.b.x), this.viewmodel.convertY(wall.b.y), 10, '#eacd28');
			
			this.drawLine(this.viewmodel.convertX(wall.getStartX()),this.viewmodel.convertY(wall.getStartY()),this.viewmodel.convertX(wall.a.x),this.viewmodel.convertY(wall.a.y),5,'#006600');
			this.drawLine(this.viewmodel.convertX(wall.a.x),this.viewmodel.convertY(wall.a.y),this.viewmodel.convertX(wall.b.x),this.viewmodel.convertY(wall.b.y),5,'#006600');
			this.drawLine(this.viewmodel.convertX(wall.b.x),this.viewmodel.convertY(wall.b.y),this.viewmodel.convertX(wall.getEndX()),this.viewmodel.convertY(wall.getEndY()),5,'#06600');
			
			this.drawLine(this.viewmodel.convertX(wall.getStartX()),this.viewmodel.convertY(wall.getStartY()),this.viewmodel.convertX(wall.a.x),this.viewmodel.convertY(wall.a.y),1,'#00FF00');
			this.drawLine(this.viewmodel.convertX(wall.a.x),this.viewmodel.convertY(wall.a.y),this.viewmodel.convertX(wall.b.x),this.viewmodel.convertY(wall.b.y),1,'#00FF00');
			this.drawLine(this.viewmodel.convertX(wall.b.x),this.viewmodel.convertY(wall.b.y),this.viewmodel.convertX(wall.getEndX()),this.viewmodel.convertY(wall.getEndY()),1,'#00FF00');
			
			this.drawCircle(this.viewmodel.convertX(wall.a.x), this.viewmodel.convertY(wall.a.y), 10, '#D7D7D7');
			this.drawCircle(this.viewmodel.convertX(wall.b.x), this.viewmodel.convertY(wall.b.y), 10, '#D7D7D7');
		}
		
		if(wall.wallType == WallTypes.STRAIGHT)
		{
			this.drawLine(this.viewmodel.convertX(wall.getStartX()),this.viewmodel.convertY(wall.getStartY()),this.viewmodel.convertX(wall.getEndX()),this.viewmodel.convertY(wall.getEndY()),hover ? wallWidthHover : selected ? wallWidthSelected : wallWidth,color);
		}
		else
		{
//			var p = {x: this.viewmodel.mouseX, y: this.viewmodel.mouseY};
//			var project = wall.bezier.project(p);
//			this.drawBezierObject(wall.bezier, 10, '#FF0000');
//			this.drawBezierObject(wall.bezier.offset(wall.thickness*0.5)[0], 3, '#F0F0F0');
//			this.drawBezierObject(wall.bezier.offset(-wall.thickness*0.5)[0], 3, '#0F0F0F');
			
			this.drawCurvedLine(
					this.viewmodel.convertX(wall.getStartX()),
					this.viewmodel.convertY(wall.getStartY()),
					
					this.viewmodel.convertX(wall.a.x),
					this.viewmodel.convertY(wall.a.y),
					
					this.viewmodel.convertX(wall.b.x),
					this.viewmodel.convertY(wall.b.y),
					
					this.viewmodel.convertX(wall.getEndX()),
					this.viewmodel.convertY(wall.getEndY()),
					hover ? wallWidthHover : selected ? wallWidthSelected : wallWidth,color);
			
//			this.drawLine(this.viewmodel.convertX(project.x),this.viewmodel.convertY(project.y),this.viewmodel.convertX(p.x),this.viewmodel.convertY(p.y), 1, '#ff0000');
		}
		
		if (!hover && !selected && wall.frontEdge)
		{
			this.drawEdge(wall.frontEdge, hover, isCurved);
		}
		if (!hover && !selected && wall.backEdge)
		{
			this.drawEdge(wall.backEdge, hover, isCurved);
		}
	}

	/** */
	drawRoom(room)
	{
		var scope = this;
		var selected = (room === this.viewmodel.selectedRoom);
		var hover = (room === this.viewmodel.activeRoom && room != this.viewmodel.selectedRoom);
		var color = roomColor;
		if (hover)
		{
			color = roomColorHover;
		}
		else if (selected)
		{
			color = roomColorSelected;
		}
		this.drawPolygon(Utils.map(room.corners, (corner) => {return scope.viewmodel.convertX(corner.x);}),Utils.map(room.corners, (corner) =>  {return scope.viewmodel.convertY(corner.y);}), true, color);
		this.drawTextLabel(Dimensioning.cmToMeasure(room.area, 2)+String.fromCharCode(178), this.viewmodel.convertX(room.areaCenter.x), this.viewmodel.convertY(room.areaCenter.y), '#0000FF', '#00FF0000', 'bold');
		this.drawTextLabel(room.name, this.viewmodel.convertX(room.areaCenter.x), this.viewmodel.convertY(room.areaCenter.y+30), '#363636', '#00FF0000', 'bold italic');
	}

	/** */
	drawCorner(corner)
	{
		var cornerX = this.viewmodel.convertX(corner.x);
		var cornerY = this.viewmodel.convertY(corner.y);
		var hover = (corner === this.viewmodel.activeCorner && corner != this.viewmodel.selectedCorner);
		var selected = (corner === this.viewmodel.selectedCorner);
		var color = cornerColor;
		if (hover && this.viewmodel.mode == floorplannerModes.DELETE)
		{
			color = deleteColor;
		}
		else if (hover)
		{
			color = cornerColorHover;
		}
		else if (selected)
		{
			color = cornerColorSelected;
		}
		this.drawCircle(cornerX, cornerY, hover ? cornerRadiusHover : selected ? cornerRadiusSelected : cornerRadius, color);
		// let cx = Dimensioning.roundOff(corner.x, 10);
		// let cy = Dimensioning.roundOff(corner.y, 10);
		// var cornerLabel = `(${cx}, ${cy})`;
		// this.drawTextLabel(cornerLabel, cornerX, cornerY);
	}

	/** */
	drawTarget(x, y, lastNode)
	{
		this.drawCircle(this.viewmodel.convertX(x),this.viewmodel.convertY(y),cornerRadiusHover,cornerColorHover);
		if (lastNode)
		{
			this.drawLine(this.viewmodel.convertX(lastNode.x),this.viewmodel.convertY(lastNode.y),this.viewmodel.convertX(x),this.viewmodel.convertY(y),wallWidthHover,wallColorHover);
		}
	}
	
	drawBezierObject(bezier, width=3, color='#f0f0f0')
	{
		this.drawCurvedLine(
		this.viewmodel.convertX(bezier.points[0].x),
		this.viewmodel.convertY(bezier.points[0].y),
		
		this.viewmodel.convertX(bezier.points[1].x),
		this.viewmodel.convertY(bezier.points[1].y),
		
		this.viewmodel.convertX(bezier.points[2].x),
		this.viewmodel.convertY(bezier.points[2].y),
		
		this.viewmodel.convertX(bezier.points[3].x),
		this.viewmodel.convertY(bezier.points[3].y),
		width,color);
	}
	
	drawCurvedLine(startX, startY, aX, aY, bX, bY, endX, endY, width, color)
	{
		this.context.beginPath();
		this.context.moveTo(startX, startY);
		this.context.bezierCurveTo(aX, aY, bX, bY, endX, endY);
//		this.context.closePath();
		this.context.lineWidth = width+3;
		this.context.strokeStyle = '#999999';
		this.context.stroke();
		
		// width is an integer
		// color is a hex string, i.e. #ff0000
		this.context.beginPath();
		this.context.moveTo(startX, startY);
		this.context.bezierCurveTo(aX, aY, bX, bY, endX, endY);
//		this.context.closePath();
		this.context.lineWidth = width;
		this.context.strokeStyle = color;
		this.context.stroke();
	}

	/** */
	drawLine(startX, startY, endX, endY, width, color)
	{
		// width is an integer
		// color is a hex string, i.e. #ff0000
		this.context.beginPath();
		this.context.moveTo(startX, startY);
		this.context.lineTo(endX, endY);
		this.context.closePath();
		this.context.lineWidth = width;
		this.context.strokeStyle = color;
		this.context.stroke();
	}
	
	/** */
	drawPolygonCurved(pointsets, fill, fillColor, stroke, strokeColor, strokeWidth)
	{
		// fillColor is a hex string, i.e. #ff0000
		fill = fill || false;
		stroke = stroke || false;
		this.context.beginPath();
		
		for (var i=0;i<pointsets.length;i++)
		{
			var pointset = pointsets[i];
//			The pointset represents a straight line if there are only 1 point in the pointset
			if(pointset.length == 1)
			{
				if(i == 0)
				{
					this.context.moveTo(this.viewmodel.convertX(pointset[0].x), this.viewmodel.convertY(pointset[0].y));
				}
				else
				{
					this.context.lineTo(this.viewmodel.convertX(pointset[0].x), this.viewmodel.convertY(pointset[0].y));
				}				
			}
//			If the pointset contains 3 points then it represents a bezier curve, ap1, ap2, cp2
			else if(pointset.length == 3)
			{
				this.context.bezierCurveTo(
						this.viewmodel.convertX(pointset[0].x), this.viewmodel.convertY(pointset[0].y),
						this.viewmodel.convertX(pointset[1].x), this.viewmodel.convertY(pointset[1].y),
						this.viewmodel.convertX(pointset[2].x), this.viewmodel.convertY(pointset[2].y)
						);
			}
		}
		
		this.context.closePath();
		if (fill)
		{
			this.context.fillStyle = fillColor;
			this.context.fill();
		}
		if (stroke)
		{
			this.context.lineWidth = strokeWidth;
			this.context.strokeStyle = strokeColor;
			this.context.stroke();
		}
		
//		Dubegging
//		for (i=0;i<pointsets.length;i++)
//		{
//			pointset = pointsets[i];
//			if(pointset.length == 3)
//			{
//				this.drawCircle(this.viewmodel.convertX(pointset[0].x), this.viewmodel.convertY(pointset[0].y), 5, '#ff0000');
//				this.drawCircle(this.viewmodel.convertX(pointset[1].x), this.viewmodel.convertY(pointset[1].y), 5, '#0000ff');
//			}
//		}
	}

	/** */
	drawPolygon(xArr, yArr, fill, fillColor, stroke, strokeColor, strokeWidth)
	{
		// fillColor is a hex string, i.e. #ff0000
		fill = fill || false;
		stroke = stroke || false;
		this.context.beginPath();
		this.context.moveTo(xArr[0], yArr[0]);
		for (var i = 1; i < xArr.length; i++)
		{
			this.context.lineTo(xArr[i], yArr[i]);
		}
		this.context.closePath();
		if (fill)
		{
			this.context.fillStyle = fillColor;
			this.context.fill();
		}
		if (stroke)
		{
			this.context.lineWidth = strokeWidth;
			this.context.strokeStyle = strokeColor;
			this.context.stroke();
		}
	}

	/** */
	drawCircle(centerX, centerY, radius, fillColor)
	{
		this.context.beginPath();
		this.context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
		this.context.closePath();
		this.context.fillStyle = fillColor;
		this.context.fill();
	}

	/** returns n where -gridSize/2 < n <= gridSize/2  */
	calculateGridOffset(n)
	{
		if (n >= 0)
		{
			return (n + (gridSpacing* Configuration.getNumericValue('scale')) / 2.0) % (gridSpacing* Configuration.getNumericValue('scale')) - (gridSpacing* Configuration.getNumericValue('scale')) / 2.0;
		}
		else
		{
			return (n - (gridSpacing* Configuration.getNumericValue('scale')) / 2.0) % (gridSpacing* Configuration.getNumericValue('scale')) + (gridSpacing* Configuration.getNumericValue('scale')) / 2.0;
		}
	}

	/** */
	drawGrid()
	{
		var offsetX = this.calculateGridOffset(-this.viewmodel.originX);
		var offsetY = this.calculateGridOffset(-this.viewmodel.originY);
		var width = this.canvasElement.width;
		var height = this.canvasElement.height;
		for (var x = 0; x <= (width / gridSpacing); x++)
		{
			this.drawLine(gridSpacing * Configuration.getNumericValue('scale') * x + offsetX, 0, gridSpacing * Configuration.getNumericValue('scale') * x + offsetX, height, gridWidth, gridColor);
		}
		for (var y = 0; y <= (height / gridSpacing); y++)
		{
			this.drawLine(0, gridSpacing * Configuration.getNumericValue('scale') * y + offsetY, width, gridSpacing * Configuration.getNumericValue('scale') * y + offsetY, gridWidth, gridColor);
		}
	}
}
