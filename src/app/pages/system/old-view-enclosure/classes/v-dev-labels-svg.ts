import { Selection } from 'd3';
import * as d3 from 'd3';
import { Application, Container, DefaultRendererPlugins } from 'pixi.js';
import { Subject } from 'rxjs';
import { SelectedEnclosureSlot } from 'app/interfaces/enclosure-old.interface';
import { EnclosureVdevDisk } from 'app/interfaces/enclosure.interface';
import { Theme } from 'app/interfaces/theme.interface';
import { ChassisView } from 'app/pages/system/old-view-enclosure/classes/chassis-view';
import {
  EnclosureEvent,
} from 'app/pages/system/old-view-enclosure/interfaces/enclosure-events.interface';

export class VDevLabelsSvg {
  /*
  * We create an SVG layer on top of the PIXI canvas
  * to achieve crisper lines. Apparently drawing
  * thin lines in WebGL is problematic without
  * resorting to caching them as bitmaps which
  * essentially renders them static.
  *
  */

  events$: Subject<EnclosureEvent>;

  protected svg: Selection<SVGSVGElement, unknown, HTMLElement, unknown>; // Our d3 generated svg layer
  protected mainStage: Container; // WebGL Canvas
  color: string;
  selectedDiskColor: string;
  highlightColor: string;
  highlightedDiskName: string;

  private trays: Record<string, { x: number; y: number; width: number; height: number }> = {};

  constructor(
    private chassis: ChassisView,
    private app: Application,
    private selectedDiskName: string,
    theme: Theme,
  ) {
    this.color = 'var(--cyan)';
    this.selectedDiskColor = 'var(--yellow)';
    this.highlightColor = theme.yellow;

    this.onInit();
  }

  onInit(): void {
    this.mainStage = this.app.stage;
    this.d3Init();

    let tiles;
    this.events$ = new Subject<EnclosureEvent>();
    this.events$.subscribe((evt: EnclosureEvent): void => {
      switch (evt.name) {
        case 'ThemeChanged': {
          const theme = (evt).data;
          this.color = theme.blue;
          this.selectedDiskColor = theme.cyan;
          this.highlightColor = theme.yellow;
          break;
        }
        case 'LabelDrives':
          this.createVdevLabels((evt).data);
          break;
        case 'DisableHighlightMode':
          tiles = this.getParent().querySelectorAll('rect.tile');
          this.showAllTiles(tiles as NodeListOf<HTMLElement>);
          break;
        case 'HighlightDisk':
          tiles = this.getParent().querySelectorAll('rect.tile');
          this.hideAllTiles(tiles as NodeListOf<HTMLElement>);

          this.highlightedDiskName = (evt).data.devname;
          this.showTile(this.highlightedDiskName);
          break;
        case 'UnhighlightDisk':
          break;
      }
    });
  }

  // Animate into view
  enter(): void {
  }

  // Animate out of view
  exit(): void {
    const op = this.getParent();
    d3.select('#' + op.id + ' svg').remove();
    d3.select('#' + op.id + ' canvas.clickpad').remove();
    (this.app.renderer.plugins as DefaultRendererPlugins).interaction.setTargetElement(this.app.renderer.view);
  }

  d3Init(): void {
    const op = this.getParent();

    this.svg = d3.select('#' + op.id).append('svg')
      .attr('width', op.offsetWidth)
      .attr('height', op.offsetHeight)
      .attr('style', 'position:absolute; top:0; left:0;');

    /* const clickpad = */
    d3.select('#' + op.id).append('canvas') // This element will capture pointer for PIXI
      .attr('class', 'clickpad')
      .attr('width', op.offsetWidth)
      .attr('height', op.offsetHeight)
      .attr('style', 'position:absolute; top:0; left:0;');

    (this.app.renderer.plugins as DefaultRendererPlugins).interaction.setTargetElement(op.querySelector('canvas.clickpad'));
  }

  getParent(): HTMLElement {
    return this.app.renderer.view.offsetParent as HTMLElement;
  }

  createVdevLabelTile(
    x: number,
    y: number,
    width: number,
    height: number,
    className: string,
    diskName: string,
  ): void {
    const color = diskName === this.selectedDiskName ? this.selectedDiskColor : this.color;

    const style = 'fill-opacity:0.25; stroke-width:1';

    this.svg.append('rect')
      .attr('class', className)
      .attr('y', y)
      .attr('x', x)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', color)
      .attr('stroke', color)
      .attr('stroke-opacity', 1)
      .attr('style', style);
  }

  createVdevLabels(data: SelectedEnclosureSlot): void {
    const poolInfo = data.slotDetails.pool_info;
    const vdevSlots: EnclosureVdevDisk[] = poolInfo?.vdev_disks.length
      ? poolInfo?.vdev_disks
      : [{
        enclosure_id: data.enclosureId,
        slot: data.slotNumber,
        dev: data.slotDetails.dev,
      }];
    vdevSlots.forEach((vdevSlot: EnclosureVdevDisk) => {
      // Ignore slots on non-selected enclosure
      if (vdevSlot.enclosure_id !== data.enclosureId) return;

      // The Actual creating of labels
      // Requirements: diskNames, isOnController
      const isInRange = (
        vdevSlot?.slot
        && vdevSlot.slot >= this.chassis.slotRange.start
        && vdevSlot.slot <= this.chassis.slotRange.end
      );
      if (isInRange) {
        // Create tile if the disk is in the current enclosure
        const dt = this.chassis.driveTrayObjects.find((dto) => parseInt(dto.id) === vdevSlot.slot);
        const src = dt.container;
        const tray = src.getGlobalPosition();

        const tileClass = vdevSlot.dev
          ? 'tile tile_' + vdevSlot.dev
          : 'tile tile_empty';

        const tileName = vdevSlot.dev ? vdevSlot.dev : 'empty';

        const tileWidth = src.width * this.chassis.driveTrays.scale.x * this.chassis.container.scale.x;
        const tileHeight = src.height * this.chassis.driveTrays.scale.y * this.chassis.container.scale.y;

        this.createVdevLabelTile(tray.x, tray.y, tileWidth, tileHeight, tileClass, tileName);
        this.trays[tileName] = {
          x: tray.x, y: tray.y, width: tileWidth, height: tileHeight,
        };
      }
    });
  }

  showTile(devname: string): void {
    const targetEl: HTMLElement = this.getParent().querySelector('rect.tile_' + devname);
    if (targetEl) {
      targetEl.style.opacity = '1';
    }
  }

  hideTile(devname: string): void {
    const targetEl: HTMLElement = this.getParent().querySelector('rect.tile_' + devname);
    if (targetEl) {
      targetEl.style.opacity = '0';
    }
  }

  hideAllTiles(tiles: NodeListOf<HTMLElement>): void {
    tiles.forEach((item) => {
      item.style.opacity = '0';
    });
  }

  showAllTiles(tiles: NodeListOf<HTMLElement>): void {
    tiles.forEach((item) => {
      item.style.opacity = '1';
    });
  }
}
