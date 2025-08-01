import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewContainerRef, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  filter, forkJoin, switchMap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { Role } from 'app/enums/role.enum';
import { helptextApps } from 'app/helptext/apps/apps';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { AppsSettingsComponent } from 'app/pages/apps/components/catalog-settings/apps-settings.component';
import { appSettingsButtonElements } from 'app/pages/apps/components/installed-apps/app-settings-button/app-settings-button.elements';
import { SelectPoolDialog } from 'app/pages/apps/components/select-pool-dialog/select-pool-dialog.component';
import { AppsStore } from 'app/pages/apps/store/apps-store.service';
import { DockerStore } from 'app/pages/apps/store/docker.store';

@UntilDestroy()
@Component({
  selector: 'ix-app-settings-button',
  templateUrl: './app-settings-button.component.html',
  styleUrls: ['./app-settings-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButton,
    TestDirective,
    UiSearchDirective,
    MatMenuTrigger,
    TranslateModule,
    IxIconComponent,
    MatMenu,
    RequiresRolesDirective,
    MatMenuItem,
    RouterLink,
    MatTooltipModule,
    AsyncPipe,
  ],
})
export class AppSettingsButtonComponent {
  private ixSlideIn = inject(SlideIn);
  private dialogService = inject(DialogService);
  private matDialog = inject(MatDialog);
  private translate = inject(TranslateService);
  private snackbar = inject(SnackbarService);
  protected dockerStore = inject(DockerStore);
  protected appsStore = inject(AppsStore);
  private viewContainerRef = inject(ViewContainerRef);

  readonly searchableElements = appSettingsButtonElements;
  protected readonly updateDockerRoles = [Role.DockerWrite];

  protected readonly helptext = helptextApps;

  onChoosePool(): void {
    this.matDialog
      .open(SelectPoolDialog, { viewContainerRef: this.viewContainerRef })
      .afterClosed()
      .pipe(filter(Boolean), untilDestroyed(this))
      .subscribe(() => this.appsStore.loadCatalog());
  }

  onUnsetPool(): void {
    this.dialogService.confirm({
      title: this.translate.instant(helptextApps.choosePool.unsetPool.confirm.title),
      message: this.translate.instant(helptextApps.choosePool.unsetPool.confirm.message),
      hideCheckbox: true,
      buttonText: this.translate.instant(helptextApps.choosePool.unsetPool.confirm.button),
    }).pipe(filter(Boolean), untilDestroyed(this)).subscribe(() => {
      this.dockerStore.setDockerPool(null).pipe(
        untilDestroyed(this),
      ).subscribe(() => {
        this.snackbar.success(this.translate.instant('Pool has been unset.'));
      });
    });
  }

  manageCatalog(): void {
    this.ixSlideIn.open(AppsSettingsComponent).pipe(
      filter((response) => !!response.response),
      switchMap(() => forkJoin([
        this.dockerStore.reloadDockerConfig(),
        this.appsStore.loadCatalog(),
      ])),
      untilDestroyed(this),
    ).subscribe();
  }
}
