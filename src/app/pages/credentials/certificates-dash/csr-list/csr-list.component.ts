import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, output, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatToolbarRow } from '@angular/material/toolbar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  filter, map, switchMap, tap,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { Role } from 'app/enums/role.enum';
import { Certificate } from 'app/interfaces/certificate.interface';
import { DialogWithSecondaryCheckboxResult } from 'app/interfaces/dialog.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { EmptyService } from 'app/modules/empty/empty.service';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { AsyncDataProvider } from 'app/modules/ix-table/classes/async-data-provider/async-data-provider';
import { IxTableComponent } from 'app/modules/ix-table/components/ix-table/ix-table.component';
import { actionsWithMenuColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-actions-with-menu/ix-cell-actions-with-menu.component';
import { textColumn } from 'app/modules/ix-table/components/ix-table-body/cells/ix-cell-text/ix-cell-text.component';
import { IxTableBodyComponent } from 'app/modules/ix-table/components/ix-table-body/ix-table-body.component';
import { IxTableHeadComponent } from 'app/modules/ix-table/components/ix-table-head/ix-table-head.component';
import { IxTablePagerShowMoreComponent } from 'app/modules/ix-table/components/ix-table-pager-show-more/ix-table-pager-show-more.component';
import { IxTableCellDirective } from 'app/modules/ix-table/directives/ix-table-cell.directive';
import { IxTableEmptyDirective } from 'app/modules/ix-table/directives/ix-table-empty.directive';
import { SortDirection } from 'app/modules/ix-table/enums/sort-direction.enum';
import { createTable } from 'app/modules/ix-table/utils';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { SnackbarService } from 'app/modules/snackbar/services/snackbar.service';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import {
  CertificateAcmeAddComponent,
} from 'app/pages/credentials/certificates-dash/certificate-acme-add/certificate-acme-add.component';
import {
  CertificateEditComponent,
} from 'app/pages/credentials/certificates-dash/certificate-edit/certificate-edit.component';
import { CsrAddComponent } from 'app/pages/credentials/certificates-dash/csr-add/csr-add.component';
import { csrListElements } from 'app/pages/credentials/certificates-dash/csr-list/csr-list.elements';
import { DownloadService } from 'app/services/download.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-csr-list',
  templateUrl: './csr-list.component.html',
  styleUrls: ['./csr-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    UiSearchDirective,
    MatToolbarRow,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    MatCardContent,
    IxTableComponent,
    IxTableEmptyDirective,
    IxTableHeadComponent,
    IxTableBodyComponent,
    IxTableCellDirective,
    IxTablePagerShowMoreComponent,
    TranslateModule,
    AsyncPipe,
  ],
})
export class CertificateSigningRequestsListComponent implements OnInit {
  private api = inject(ApiService);
  private slideIn = inject(SlideIn);
  private translate = inject(TranslateService);
  protected emptyService = inject(EmptyService);
  private download = inject(DownloadService);
  private dialogService = inject(DialogService);
  private errorHandler = inject(ErrorHandlerService);
  private snackbar = inject(SnackbarService);

  protected certificateCreated = output();

  protected readonly requiredRoles = [Role.CertificateWrite];
  protected readonly searchableElements = csrListElements;

  dataProvider: AsyncDataProvider<Certificate>;
  certificates: Certificate[] = [];
  columns = createTable<Certificate>([
    textColumn({
      title: this.translate.instant('Name'),
      propertyName: 'name',
    }),
    textColumn({
      title: this.translate.instant('CN'),
      propertyName: 'common',
    }),
    actionsWithMenuColumn({
      actions: [
        {
          iconName: iconMarker('build'),
          tooltip: this.translate.instant('Create ACME Certificate'),
          requiredRoles: this.requiredRoles,
          onClick: (row) => this.doCreateAcmeCert(row),
        },
        {
          iconName: iconMarker('mdi-download'),
          tooltip: this.translate.instant('Download'),
          onClick: (row) => this.doDownload(row),
        },
        {
          iconName: iconMarker('edit'),
          tooltip: this.translate.instant('Edit'),
          onClick: (row) => this.doEdit(row),
        },
        {
          iconName: iconMarker('mdi-delete'),
          requiredRoles: this.requiredRoles,
          tooltip: this.translate.instant('Delete'),
          onClick: (row) => this.doDelete(row),
        },
      ],
    }),
  ], {
    uniqueRowTag: (row) => 'csr-' + row.name,
    ariaLabels: (row) => [row.name, this.translate.instant('CSR')],
  });

  ngOnInit(): void {
    const certificates$ = this.api.call('certificate.query').pipe(
      map((certificates) => certificates.filter((certificate) => certificate.CSR !== null)),
      tap((certificates) => this.certificates = certificates),
      untilDestroyed(this),
    );
    this.dataProvider = new AsyncDataProvider<Certificate>(certificates$);
    this.setDefaultSort();
    this.getCertificates();
  }

  getCertificates(): void {
    this.dataProvider.load();
  }

  setDefaultSort(): void {
    this.dataProvider.setSorting({
      active: 1,
      direction: SortDirection.Asc,
      propertyName: 'id',
    });
  }

  doAdd(): void {
    this.slideIn.open(CsrAddComponent).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => {
      this.getCertificates();
    });
  }

  doEdit(certificate: Certificate): void {
    this.slideIn.open(CertificateEditComponent, {
      wide: true,
      data: certificate,
    }).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => {
      this.getCertificates();
    });
  }

  doDelete(certificate: Certificate): void {
    this.dialogService.confirm({
      title: this.translate.instant('Delete Certificate'),
      message: this.translate.instant('Are you sure you want to delete "{name}"?', { name: certificate.name }),
      hideCheckbox: true,
      secondaryCheckbox: true,
      secondaryCheckboxText: this.translate.instant('Force'),
      buttonColor: 'warn',
      buttonText: this.translate.instant('Delete'),
    }).pipe(
      filter((confirmation: DialogWithSecondaryCheckboxResult) => confirmation.confirmed),
      switchMap((confirmation: DialogWithSecondaryCheckboxResult) => {
        const force = confirmation.secondaryCheckbox;

        const jobDialogRef = this.dialogService.jobDialog(
          this.api.job('certificate.delete', [certificate.id, force]),
          { title: this.translate.instant('Deleting...') },
        );

        return jobDialogRef.afterClosed();
      }),
      this.errorHandler.withErrorHandler(),
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('CSR deleted'));
        this.getCertificates();
      },
    });
  }

  doDownload(certificate: Certificate): void {
    const isCsr = certificate.cert_type_CSR;
    const path = isCsr ? certificate.csr_path : certificate.certificate_path;
    const fileName = `${certificate.name}.${isCsr ? 'csr' : 'crt'}`;

    this.download.coreDownload({
      fileName,
      method: 'filesystem.get',
      mimeType: 'application/x-x509-user-cert',
      arguments: [path],
    })
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe();

    this.download.coreDownload({
      method: 'filesystem.get',
      fileName: `${certificate.name}.key`,
      arguments: [certificate.privatekey_path],
      mimeType: 'text/plain',
    })
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe();
  }

  private doCreateAcmeCert(csr: Certificate): void {
    this.slideIn.open(CertificateAcmeAddComponent, { data: csr }).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => {
      this.certificateCreated.emit();
      this.getCertificates();
    });
  }
}
