import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { FormBuilder, FormControl } from '@ngneat/reactive-forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { isNumber } from 'lodash-es';
import {
  concatMap, firstValueFrom, forkJoin, mergeMap, Observable, of, from,
} from 'rxjs';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { ComboboxQueryType } from 'app/enums/combobox.enum';
import { NfsAclTag, smbAclTagLabels } from 'app/enums/nfs-acl.enum';
import { Role } from 'app/enums/role.enum';
import { SmbSharesecPermission, SmbSharesecType } from 'app/enums/smb-sharesec.enum';
import { mapToOptions } from 'app/helpers/options.helper';
import { helptextSharingSmb } from 'app/helptext/sharing';
import { Group } from 'app/interfaces/group.interface';
import { Option } from 'app/interfaces/option.interface';
import { QueryFilter } from 'app/interfaces/query-api.interface';
import { SmbSharesecAce } from 'app/interfaces/smb-share.interface';
import { User } from 'app/interfaces/user.interface';
import { GroupComboboxProvider } from 'app/modules/forms/ix-forms/classes/group-combobox-provider';
import { UserComboboxProvider } from 'app/modules/forms/ix-forms/classes/user-combobox-provider';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxComboboxComponent } from 'app/modules/forms/ix-forms/components/ix-combobox/ix-combobox.component';
import { IxErrorsComponent } from 'app/modules/forms/ix-forms/components/ix-errors/ix-errors.component';
import { IxFieldsetComponent } from 'app/modules/forms/ix-forms/components/ix-fieldset/ix-fieldset.component';
import { IxListItemComponent } from 'app/modules/forms/ix-forms/components/ix-list/ix-list-item/ix-list-item.component';
import { IxListComponent } from 'app/modules/forms/ix-forms/components/ix-list/ix-list.component';
import { IxSelectComponent } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ModalHeaderComponent } from 'app/modules/slide-ins/components/modal-header/modal-header.component';
import { SlideInRef } from 'app/modules/slide-ins/slide-in-ref';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ignoreTranslation } from 'app/modules/translate/translate.helper';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { UserService } from 'app/services/user.service';

type NameOrId = string | number | null;

interface FormAclEntry {
  ae_who_sid: string;
  ae_who: NfsAclTag.Everyone | NfsAclTag.UserGroup | NfsAclTag.User | null;
  ae_perm: SmbSharesecPermission;
  ae_type: SmbSharesecType;
  user: NameOrId;
  group: NameOrId;
  both: NameOrId;
}

@UntilDestroy()
@Component({
  selector: 'ix-smb-acl',
  templateUrl: './smb-acl.component.html',
  styleUrls: ['./smb-acl.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalHeaderComponent,
    MatCard,
    MatCardContent,
    ReactiveFormsModule,
    IxFieldsetComponent,
    IxListComponent,
    IxListItemComponent,
    IxSelectComponent,
    IxComboboxComponent,
    IxErrorsComponent,
    FormActionsComponent,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
  ],
})
export class SmbAclComponent implements OnInit {
  private formBuilder = inject(FormBuilder);
  private api = inject(ApiService);
  private formErrorHandler = inject(FormErrorHandlerService);
  private errorHandler = inject(ErrorHandlerService);
  private translate = inject(TranslateService);
  private userService = inject(UserService);
  slideInRef = inject<SlideInRef<string, boolean>>(SlideInRef);

  form = this.formBuilder.group({
    entries: this.formBuilder.array<FormAclEntry>([]),
  });

  protected isLoading = signal(false);
  protected shareName: string;

  private shareAclName: string;

  readonly tags$ = of(mapToOptions(smbAclTagLabels, this.translate));
  protected readonly requiredRoles = [Role.SharingSmbWrite, Role.SharingWrite];
  readonly permissions$ = of([
    {
      label: 'FULL',
      value: SmbSharesecPermission.Full,
    },
    {
      label: 'CHANGE',
      value: SmbSharesecPermission.Change,
    },
    {
      label: 'READ',
      value: SmbSharesecPermission.Read,
    },
  ] as Option[]);

  readonly types$ = of([
    {
      label: 'ALLOWED',
      value: SmbSharesecType.Allowed,
    },
    {
      label: 'DENIED',
      value: SmbSharesecType.Denied,
    },
  ] as Option[]);

  readonly helptext = helptextSharingSmb;
  readonly nfsAclTag = NfsAclTag;
  readonly userProvider = new UserComboboxProvider(
    this.userService,
    { valueField: 'uid', queryType: ComboboxQueryType.Smb },
  );

  protected groupProvider: GroupComboboxProvider;

  constructor() {
    const slideInRef = this.slideInRef;

    this.slideInRef.requireConfirmationWhen(() => {
      return of(this.form.dirty);
    });
    this.shareName = slideInRef.getData();
  }

  ngOnInit(): void {
    if (this.shareName) {
      this.setSmbShareName();
    }
  }

  private setSmbShareName(): void {
    this.loadSmbAcl(this.shareName);
  }

  addAce(): void {
    this.form.controls.entries.push(
      this.formBuilder.group({
        ae_who_sid: [''],
        ae_who: [null as never],
        both: [null as never],
        user: [null as never],
        group: [null as never],
        ae_perm: new FormControl(null as SmbSharesecPermission | null),
        ae_type: new FormControl(null as SmbSharesecType | null),
      }),
    );
  }

  removeAce(index: number): void {
    this.form.controls.entries.removeAt(index);
  }

  onSubmit(): void {
    this.isLoading.set(true);

    of(undefined)
      .pipe(mergeMap(() => this.getAclEntriesFromForm()))
      .pipe(mergeMap((acl) => this.api.call('sharing.smb.setacl', [{ share_name: this.shareAclName, share_acl: acl }])))
      .pipe(untilDestroyed(this))
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.slideInRef.close({ response: true });
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.formErrorHandler.handleValidationErrors(error, this.form);
        },
      });
  }

  private loadSmbAcl(shareName: string): void {
    this.isLoading.set(true);
    this.api.call('sharing.smb.getacl', [{ share_name: shareName }])
      .pipe(untilDestroyed(this))
      .subscribe({
        next: (shareAcl) => {
          this.shareAclName = shareAcl.share_name;
          shareAcl.share_acl.forEach((ace, i) => {
            this.addAce();

            this.form.controls.entries.at(i).patchValue({
              ae_who_sid: ace.ae_who_sid,
              ae_who: ace.ae_who_id?.id_type || ace.ae_who_str as NfsAclTag.Everyone,
              ae_perm: ace.ae_perm,
              ae_type: ace.ae_type,
              both: ace.ae_who_id?.id_type !== NfsAclTag.Everyone ? ace.ae_who_id?.id : null,
              group: ace.ae_who_id?.id_type !== NfsAclTag.Everyone ? ace.ae_who_id?.id : null,
              user: ace.ae_who_id?.id_type !== NfsAclTag.Everyone ? ace.ae_who_id?.id : null,
            });
          });
          this.extractOptionFromAcl(shareAcl.share_acl);
        },
        error: (error: unknown) => {
          this.errorHandler.showErrorModal(error);
          this.isLoading.set(false);
        },
      });
  }

  private async getAclEntriesFromForm(): Promise<SmbSharesecAce[]> {
    const results = [] as SmbSharesecAce[];
    for (const ace of this.form.value.entries) {
      let whoIdOrName = ace.both;
      if (ace.ae_who === NfsAclTag.User) {
        whoIdOrName = ace.user;
      } else if (ace.ae_who === NfsAclTag.UserGroup) {
        whoIdOrName = ace.group;
      }

      const result = { ae_perm: ace.ae_perm, ae_type: ace.ae_type } as SmbSharesecAce;

      if (ace.ae_who === NfsAclTag.Everyone) {
        result.ae_who_sid = 'S-1-1-0';
      } else {
        let id: number;
        if (isNumber(whoIdOrName)) {
          id = Number(whoIdOrName);
        } else if (ace.ae_who === NfsAclTag.UserGroup) {
          id = (await firstValueFrom(this.userService.getGroupByName(String(whoIdOrName))))
            .gr_gid;
        } else {
          id = (await firstValueFrom(this.userService.getUserByName(String(whoIdOrName))))
            .pw_uid;
        }

        result.ae_who_id = { id_type: ace.ae_who, id };
      }
      results.push(result);
    }
    return results;
  }

  private initialValueDataFromAce(
    ace: SmbSharesecAce,
  ): Observable<Group[]> | Observable<User[]> | Observable<string[]> {
    if (ace.ae_who_id?.id_type === NfsAclTag.UserGroup) {
      const queryArgs: QueryFilter<Group>[] = [['gid', '=', ace.ae_who_id?.id], ['smb', '=', true]];
      return this.api.call('group.query', [queryArgs]);
    }

    if (ace.ae_who_id?.id_type === NfsAclTag.User) {
      const queryArgs: QueryFilter<User>[] = [['uid', '=', ace.ae_who_id?.id], ['smb', '=', true]];
      return this.api.call('user.query', [queryArgs]);
    }

    return of([]);
  }

  private extractOptionFromAcl(shareAcl: SmbSharesecAce[]): void {
    from(shareAcl)
      .pipe(
        concatMap((ace: SmbSharesecAce) => {
          return forkJoin(
            this.initialValueDataFromAce(ace),
          );
        }),
      )
      .pipe(untilDestroyed(this))
      .subscribe((data: unknown[][]) => {
        const response = data[0];
        const initialOptions: Option[] = [];

        if (response.length) {
          const firstItem = response[0] as Group | User;
          let option: Option;

          if ('gid' in firstItem) {
            option = {
              label: ignoreTranslation(firstItem.group),
              value: firstItem.gid,
            };
          } else if ('uid' in firstItem || (firstItem as User).uid?.toString() === '0') {
            option = {
              label: ignoreTranslation(firstItem.username),
              value: firstItem.uid,
            };
          } else {
            return;
          }

          initialOptions.push(option);
        }

        this.groupProvider = new GroupComboboxProvider(this.userService, {
          initialOptions,
          valueField: 'gid',
          queryType: ComboboxQueryType.Smb,
        });

        this.isLoading.set(false);
      });
  }
}
