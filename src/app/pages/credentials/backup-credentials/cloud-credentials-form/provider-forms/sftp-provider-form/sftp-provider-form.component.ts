import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { KeychainCredentialType } from 'app/enums/keychain-credential-type.enum';
import { idNameArrayToOptions } from 'app/helpers/operators/options.operators';
import { helptextSystemCloudcredentials as helptext } from 'app/helptext/system/cloud-credentials';
import { Option } from 'app/interfaces/option.interface';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { ApiService } from 'app/modules/websocket/api.service';
import {
  BaseProviderFormComponent,
} from 'app/pages/credentials/backup-credentials/cloud-credentials-form/provider-forms/base-provider-form';

const newOption = 'NEW';

@UntilDestroy()
@Component({
  selector: 'ix-sftp-provider-form',
  templateUrl: './sftp-provider-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxFieldsetComponent,
    ReactiveFormsModule,
    IxInputComponent,
    IxSelectComponent,
    TranslateModule,
  ],
})
export class SftpProviderFormComponent extends BaseProviderFormComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private formBuilder = inject(FormBuilder);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);

  form = this.formBuilder.group({
    host: ['', Validators.required],
    port: [null as number | null],
    user: ['', Validators.required],
    pass: [''],
    private_key: [null as number | typeof newOption | null],
  });

  privateKeys$: Observable<Option[]>;

  override beforeSubmit(): Observable<unknown> {
    if (this.form.value.private_key !== newOption) {
      return of(true);
    }

    return this.makeNewKeypair();
  }

  override readonly helptext = helptext;

  ngOnInit(): void {
    this.loadPrivateKeys();
  }

  ngAfterViewInit(): void {
    this.formPatcher$.pipe(untilDestroyed(this)).subscribe((values) => {
      this.form.patchValue(values);
      this.cdr.detectChanges();
    });
  }

  private loadPrivateKeys(): void {
    this.privateKeys$ = this.api.call('keychaincredential.query', [[['type', '=', KeychainCredentialType.SshKeyPair]]])
      .pipe(
        idNameArrayToOptions(),
        map((options) => {
          return [
            {
              label: this.translate.instant('Generate New'),
              value: newOption,
            },
            ...options,
          ];
        }),
      );
  }

  private makeNewKeypair(): Observable<unknown> {
    return this.api.call('keychaincredential.generate_ssh_key_pair').pipe(
      switchMap((keypair) => {
        const createCredential = {
          name: this.translate.instant('{key} Key', {
            key: this.form.value.host,
          }),
          type: KeychainCredentialType.SshKeyPair,
          attributes: keypair,
        };

        return this.api.call('keychaincredential.create', [createCredential]).pipe(
          tap((createdKey) => {
            this.loadPrivateKeys();
            this.form.patchValue({
              private_key: createdKey.id,
            });
          }),
        );
      }),
    );
  }
}
