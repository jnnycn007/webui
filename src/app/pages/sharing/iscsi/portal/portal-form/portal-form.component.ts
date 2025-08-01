import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, signal, inject } from '@angular/core';
import { Validators, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { FormBuilder } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { choicesToOptions } from 'app/helpers/operators/options.operators';
import { helptextIscsi } from 'app/helptext/sharing';
import { IscsiInterface, IscsiPortal } from 'app/interfaces/iscsi.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxListItemComponent } from 'app/modules/forms/ix-forms/components/ix-list/ix-list-item/ix-list-item.component';
import { IxListComponent } from 'app/modules/forms/ix-forms/components/ix-list/ix-list.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ipValidator } from 'app/modules/forms/ix-forms/validators/ip-validation';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { IscsiService } from 'app/services/iscsi.service';

@UntilDestroy()
@Component({
  selector: 'ix-portal-form',
  templateUrl: './portal-form.component.html',
  styleUrls: ['./portal-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxInputComponent,
    IxSelectComponent,
    IxListComponent,
    IxListItemComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class PortalFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  protected api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);
  private errorHandler = inject(FormErrorHandlerService);
  protected iscsiService = inject(IscsiService);
  slideInRef = inject<SlideInRef<IscsiPortal | undefined, boolean>>(SlideInRef);

  protected isLoading = signal(false);
  listen: IscsiInterface[] = [];

  get isNew(): boolean {
    return !this.editingIscsiPortal;
  }

  get title(): string {
    return this.isNew
      ? this.translate.instant('Add Portal')
      : this.translate.instant('Edit Portal');
  }

  form = this.fb.group({
    comment: [''],
    ip: this.fb.array<string>([], [Validators.required]),
  });

  readonly labels = {
    comment: helptextIscsi.portal.descriptionLabel,
    ip: helptextIscsi.portal.ipLabel,
    port: helptextIscsi.portal.portLabel,
  };

  readonly tooltips = {
    ip: helptextIscsi.portal.ipTooltip,
    port: helptextIscsi.portal.portTooltip,
  };

  readonly listenOptions$ = this.iscsiService.getIpChoices().pipe(choicesToOptions());

  protected editingIscsiPortal: IscsiPortal | undefined;

  protected readonly requiredRoles = [
    Role.SharingIscsiPortalWrite,
    Role.SharingIscsiWrite,
    Role.SharingWrite,
  ];

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
    this.editingIscsiPortal = this.slideInRef.getData();
  }

  ngOnInit(): void {
    if (this.editingIscsiPortal) {
      this.setupForm(this.editingIscsiPortal);
    }
  }

  setupForm(portal: IscsiPortal): void {
    portal.listen.forEach((listen) => {
      const newListItem = {} as IscsiInterface;
      newListItem.ip = listen.ip;
      this.form.controls.ip.push(this.fb.control(listen.ip, [Validators.required, ipValidator('all')]));
      this.listen.push(newListItem);
    });

    this.form.patchValue({
      ...portal,
    });
  }

  protected onAdd(): void {
    this.form.controls.ip.push(this.fb.control('', [Validators.required, ipValidator('all')]));
    this.listen.push({ ip: '' } as IscsiInterface);
  }

  protected onDelete(index: number): void {
    this.form.controls.ip.removeAt(index);
    this.listen.splice(index, 1);
  }

  protected onSubmit(): void {
    const values = this.form.value;
    const params = {
      comment: values.comment,
      listen: values.ip.map((ip) => ({ ip })) as IscsiInterface[],
    };

    this.isLoading.set(true);
    let request$: Observable<unknown>;
    if (this.editingIscsiPortal) {
      request$ = this.api.call('iscsi.portal.update', [this.editingIscsiPortal.id, params]);
    } else {
      request$ = this.api.call('iscsi.portal.create', [params]);
    }

    request$.pipe(untilDestroyed(this)).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.slideInRef.close({ response: true });
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.errorHandler.handleValidationErrors(error, this.form);
      },
    });
  }
}
