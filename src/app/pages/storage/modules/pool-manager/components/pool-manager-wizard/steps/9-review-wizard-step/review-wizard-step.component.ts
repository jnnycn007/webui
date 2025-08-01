import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, input, OnInit, output, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatStepperPrevious, MatStepperNext } from '@angular/material/stepper';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { VDevType, vdevTypeLabels } from 'app/enums/v-dev-type.enum';
import { isTopologyLimitedToOneLayout } from 'app/helpers/storage.helper';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { FileSizePipe } from 'app/modules/pipes/file-size/file-size.pipe';
import { MapValuePipe } from 'app/modules/pipes/map-value/map-value.pipe';
import { TestDirective } from 'app/modules/test-id/test.directive';
import {
  InspectVdevsDialog,
} from 'app/pages/storage/modules/pool-manager/components/inspect-vdevs-dialog/inspect-vdevs-dialog.component';
import { PoolCreationSeverity } from 'app/pages/storage/modules/pool-manager/enums/pool-creation-severity';
import { PoolCreationError } from 'app/pages/storage/modules/pool-manager/interfaces/pool-creation-error';
import { TopologyCategoryDescriptionPipe } from 'app/pages/storage/modules/pool-manager/pipes/topology-category-description.pipe';
import { PoolManagerValidationService } from 'app/pages/storage/modules/pool-manager/store/pool-manager-validation.service';
import {
  PoolManagerState,
  PoolManagerStore,
  PoolManagerTopology, PoolManagerTopologyCategory,
} from 'app/pages/storage/modules/pool-manager/store/pool-manager.store';

@UntilDestroy()
@Component({
  selector: 'ix-review-wizard-step',
  templateUrl: './review-wizard-step.component.html',
  styleUrls: ['./review-wizard-step.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    MatStepperPrevious,
    TestDirective,
    MatStepperNext,
    RequiresRolesDirective,
    TranslateModule,
    FileSizePipe,
    MapValuePipe,
    AsyncPipe,
    TopologyCategoryDescriptionPipe,
  ],
})
export class ReviewWizardStepComponent implements OnInit {
  private matDialog = inject(MatDialog);
  private store = inject(PoolManagerStore);
  private cdr = inject(ChangeDetectorRef);
  private dialogService = inject(DialogService);
  private translate = inject(TranslateService);
  private poolManagerValidation = inject(PoolManagerValidationService);

  readonly isAddingVdevs = input<boolean>();

  readonly vDevType = VDevType;
  readonly createPool = output();

  state: PoolManagerState;
  nonEmptyTopologyCategories: [VDevType, PoolManagerTopologyCategory][] = [];
  poolCreationErrors: PoolCreationError[];
  isCreateDisabled = false;

  protected totalCapacity$ = this.store.totalUsableCapacity$;
  protected readonly vdevTypeLabels = vdevTypeLabels;
  protected isLimitedToOneLayout = isTopologyLimitedToOneLayout;

  protected readonly Role = Role;

  get showStartOver(): boolean {
    return Boolean(this.state.name || this.state.encryption || this.nonEmptyTopologyCategories?.length);
  }

  get hasVdevs(): boolean {
    return Object.keys(this.state.topology).some((type) => {
      return this.state.topology[type as VDevType].vdevs.length > 0;
    });
  }

  get limitToEnclosureName(): string | undefined {
    const limitToSingleEnclosure = this.state.enclosureSettings.limitToSingleEnclosure;
    if (limitToSingleEnclosure === null) {
      return undefined;
    }

    return this.state.enclosures.find((enclosure) => {
      return enclosure.id === this.state.enclosureSettings.limitToSingleEnclosure;
    })?.name;
  }

  ngOnInit(): void {
    this.store.state$.pipe(untilDestroyed(this)).subscribe((state) => {
      this.state = state;
      this.nonEmptyTopologyCategories = this.filterNonEmptyCategories(state.topology);
      this.cdr.markForCheck();
    });

    this.poolManagerValidation.getPoolCreationErrors().pipe(untilDestroyed(this)).subscribe((errors) => {
      this.poolCreationErrors = errors;
      this.isCreateDisabled = !!errors.filter((error) => error.severity === PoolCreationSeverity.Error).length;
    });
  }

  onInspectVdevsPressed(): void {
    this.matDialog.open(InspectVdevsDialog, {
      data: {
        topology: this.state.topology,
        enclosures: this.state.enclosures,
      },
      panelClass: 'inspect-vdevs-dialog',
    });
  }

  private filterNonEmptyCategories(topology: PoolManagerTopology): [VDevType, PoolManagerTopologyCategory][] {
    return Object.keys(topology).reduce((acc, type) => {
      const category = topology[type as VDevType];
      if (category.vdevs.length > 0) {
        acc.push([type as VDevType, category]);
      }
      return acc;
    }, [] as [VDevType, PoolManagerTopologyCategory][]);
  }

  startOver(): void {
    this.dialogService
      .confirm({
        title: this.translate.instant('Start Over'),
        message: this.translate.instant('Are you sure you want to start over?'),
        hideCheckbox: false,
        buttonText: this.translate.instant('Start Over'),
      })
      .pipe(
        filter(Boolean),
        untilDestroyed(this),
      ).subscribe(() => {
        this.store.startOver();
      });
  }
}
