import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { Validators, ReactiveFormsModule, NonNullableFormBuilder } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {
  debounceTime, merge, Observable, of,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { IscsiAuthMethod } from 'app/enums/iscsi.enum';
import { Role } from 'app/enums/role.enum';
import { helptextIscsi } from 'app/helptext/sharing';
import { IscsiAuthAccess, IscsiAuthAccessUpdate } from 'app/interfaces/iscsi.interface';
import { Option } from 'app/interfaces/option.interface';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { IxValidatorsService } from 'app/modules/forms/ix-forms/services/ix-validators.service';
import {
  doesNotEqualFgValidator,
  matchOthersFgValidator,
} from 'app/modules/forms/ix-forms/validators/password-validation/password-validation';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';

@UntilDestroy()
@Component({
  selector: 'ix-authorized-access-form',
  templateUrl: './authorized-access-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxInputComponent,
    IxSelectComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class AuthorizedAccessFormComponent implements OnInit {
  private translate = inject(TranslateService);
  private formBuilder = inject(NonNullableFormBuilder);
  private errorHandler = inject(FormErrorHandlerService);
  private api = inject(ApiService);
  private validatorService = inject(IxValidatorsService);
  slideInRef = inject<SlideInRef<IscsiAuthAccess | undefined, boolean>>(SlideInRef);

  get isNew(): boolean {
    return !this.editingAccess;
  }

  get title(): string {
    return this.isNew
      ? this.translate.instant('Add Authorized Access')
      : this.translate.instant('Edit Authorized Access');
  }

  form = this.formBuilder.group({
    tag: [null as number | null, [Validators.required, Validators.min(0)]],
    user: ['', Validators.required],
    secret: ['', [
      Validators.minLength(12),
      Validators.maxLength(16),
      Validators.required,
    ]],
    secret_confirm: ['', Validators.required],
    peeruser: [''],
    peersecret: ['', [
      this.validatorService.validateOnCondition(
        () => this.isPeerUserSet(),
        Validators.required,
      ),
      Validators.minLength(12),
      Validators.maxLength(16),
    ]],
    peersecret_confirm: [''],
    discovery_auth: [IscsiAuthMethod.None],
  }, {
    validators: [
      matchOthersFgValidator(
        'secret',
        ['secret_confirm'],
        this.translate.instant('Secret and confirmation should match.'),
      ),
      matchOthersFgValidator(
        'peersecret',
        ['peersecret_confirm'],
        this.translate.instant('Secret and confirmation should match.'),
      ),
      doesNotEqualFgValidator(
        'peersecret',
        ['secret'],
        this.translate.instant('Secret and Peer Secret cannot be the same.'),
      ),
    ],
  });

  protected isLoading = signal(false);
  discoveryAuthOptions$: Observable<Option<IscsiAuthMethod>[]>;
  protected editingAccess: IscsiAuthAccess | undefined;

  readonly defaultDiscoveryAuthOptions = [
    {
      label: 'NONE',
      value: IscsiAuthMethod.None,
    },
    {
      label: 'CHAP',
      value: IscsiAuthMethod.Chap,
    },
  ];

  readonly tooltips = {
    tag: helptextIscsi.authaccess.tagTooltip,
    user: helptextIscsi.authaccess.userTooltip,
    secret: helptextIscsi.authaccess.userTooltip,
    peeruser: helptextIscsi.authaccess.peeruserTooltip,
    peersecret: helptextIscsi.authaccess.peersecretTooltip,
    discovery_auth: helptextIscsi.portal.discoveryAuthMethodTooltip,
  };

  protected readonly requiredRoles = [
    Role.SharingIscsiAuthWrite,
    Role.SharingIscsiWrite,
    Role.SharingWrite,
  ];

  constructor() {
    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
    this.editingAccess = this.slideInRef.getData();
  }

  ngOnInit(): void {
    this.discoveryAuthOptions$ = of(this.defaultDiscoveryAuthOptions);

    merge(
      this.form.controls.peeruser.valueChanges,
      this.form.controls.peersecret.valueChanges,
    ).pipe(debounceTime(300), untilDestroyed(this)).subscribe(() => {
      if (this.form.value.peeruser && this.form.value.peersecret) {
        this.discoveryAuthOptions$ = of([
          ...this.defaultDiscoveryAuthOptions,
          {
            label: 'Mutual CHAP',
            value: IscsiAuthMethod.ChapMutual,
          },
        ]);
        if (this.form.value.discovery_auth === IscsiAuthMethod.ChapMutual) {
          this.form.controls.discovery_auth.setValue(IscsiAuthMethod.ChapMutual);
        }
      } else {
        this.discoveryAuthOptions$ = of(this.defaultDiscoveryAuthOptions);
        if (this.form.value.discovery_auth === IscsiAuthMethod.ChapMutual) {
          this.form.controls.discovery_auth.setValue(IscsiAuthMethod.None);
        }
      }
    });

    if (this.editingAccess) {
      this.setAccessForEdit(this.editingAccess);
    }
  }

  protected isPeerUserSet(): boolean {
    return Boolean(this.form?.value?.peeruser);
  }

  private setAccessForEdit(access: IscsiAuthAccess): void {
    this.form.patchValue({
      ...access,
      secret_confirm: access.secret,
      peersecret_confirm: access.peersecret,
    });
  }

  protected onSubmit(): void {
    const values = this.form.getRawValue();
    const payload = {
      tag: values.tag,
      user: values.user,
      secret: values.secret,
      peeruser: values.peeruser,
      peersecret: values.peersecret,
      discovery_auth: values.discovery_auth,
    } as IscsiAuthAccessUpdate;

    this.isLoading.set(true);
    const request$ = this.editingAccess
      ? this.api.call('iscsi.auth.update', [this.editingAccess.id, payload])
      : this.api.call('iscsi.auth.create', [payload]);

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
