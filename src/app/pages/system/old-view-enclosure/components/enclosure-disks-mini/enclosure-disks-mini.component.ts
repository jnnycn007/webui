import {
  ChangeDetectorRef, Component, ElementRef, ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { Point } from 'pixi.js';
import { EnclosureModel } from 'app/enums/enclosure-model.enum';
import { DashboardEnclosureSlot } from 'app/interfaces/enclosure.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { Mini } from 'app/pages/system/old-view-enclosure/classes/hardware/mini';
import { MiniX } from 'app/pages/system/old-view-enclosure/classes/hardware/mini-x';
import { MiniXlPlus } from 'app/pages/system/old-view-enclosure/classes/hardware/mini-xl-plus';
import {
  EnclosureDisksComponent,
} from 'app/pages/system/old-view-enclosure/components/enclosure-disks/enclosure-disks.component';
import { EnclosureStore } from 'app/pages/system/old-view-enclosure/stores/enclosure-store.service';
import { DiskTemperatureService } from 'app/services/disk-temperature.service';
import { ThemeService } from 'app/services/theme/theme.service';
import { WebSocketService } from 'app/services/ws.service';
import { AppState } from 'app/store/index';

// TODO: Fix change detection when the opportunity to test is there.
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: 'ix-enclosure-disks-mini',
  templateUrl: './enclosure-disks-mini.component.html',
  styleUrls: ['../enclosure-disks/enclosure-disks.component.scss'],
})
export class EnclosureDisksMiniComponent extends EnclosureDisksComponent {
  @ViewChild('cardcontent', { static: true }) cardContent: ElementRef;

  temperatureScales = false;
  override emptySlotView = this.defaultView;

  get enclosurePools(): string[] {
    return this.enclosureStore?.getPools(this.selectedEnclosure);
  }

  get totalDisks(): number {
    const allSlots = this.asArray(
      this.selectedEnclosure.elements['Array Device Slot'],
    ) as [string, DashboardEnclosureSlot][];

    return allSlots.map((keyValue) => keyValue[1]).filter((slot) => slot.dev !== null).length;
  }

  constructor(
    public override cdr: ChangeDetectorRef,
    public override dialogService: DialogService,
    protected override translate: TranslateService,
    protected override ws: WebSocketService,
    protected override store$: Store<AppState>,
    protected override themeService: ThemeService,
    protected override diskTemperatureService: DiskTemperatureService,
    protected override matDialog: MatDialog,
    protected override enclosureStore: EnclosureStore,
  ) {
    super(
      cdr,
      dialogService,
      translate,
      ws,
      store$,
      themeService,
      diskTemperatureService,
      matDialog,
      enclosureStore,
    );
    this.pixiWidth = 320;// 960 * 0.6; // PIXI needs an explicit number. Make sure the template flex width matches this
    this.pixiHeight = 480;
  }

  override createExtractedEnclosure(): void {
    // MINIs have no support for expansion shelves
    // therefore we will never need to create
    // any enclosure selection UI. Leave this
    // empty or the base class will throw errors
    console.error('Cannot create extracted enclosure for selector UI. MINI products do not support expansion shelves');
  }

  override createEnclosure(enclosure = this.selectedEnclosure): void {
    if (!this.enclosureViews || !this.selectedEnclosure) {
      console.warn('CANNOT CREATE MINI ENCLOSURE');
      return;
    }

    switch (enclosure.model) {
      case EnclosureModel.Mini3E:
      case EnclosureModel.Mini3EPlus:
        this.chassis = new Mini();
        break;
      case EnclosureModel.Mini3X:
      case EnclosureModel.Mini3XPlus:
        this.chassis = new MiniX();
        break;
      case EnclosureModel.Mini3XlPlus:
        this.chassis = new MiniXlPlus();
        break;
      default:
        this.controllerEvent$.next({
          name: 'Error',
          data: {
            name: 'Unsupported Hardware',
            message: 'This chassis has an unknown or missing model value. METHOD: createEnclosure',
          },
        });
        this.aborted = true;
        break;
    }

    if (this.aborted) {
      return;
    }

    this.setupChassisViewEvents();

    // Slight adjustment to align with external html elements
    this.container.setTransform(0);
  }

  /* count(obj: Record<string, unknown> | unknown[]): number {
    return Object.keys(obj).length;
  } */

  stackPositions(log = false): Point[] {
    const result = this.chassisView.driveTrayObjects.map((dt) => dt.container.getGlobalPosition());

    if (log) {
      console.warn(result);
    }
    return result;
  }
}
