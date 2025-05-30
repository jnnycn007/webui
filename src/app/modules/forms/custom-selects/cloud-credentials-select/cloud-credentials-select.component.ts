import { ComponentType } from '@angular/cdk/portal';
import {
  Component, forwardRef, inject, ChangeDetectionStrategy, input,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, map } from 'rxjs';
import { CloudSyncProviderName, cloudSyncProviderNameMap } from 'app/enums/cloudsync-provider.enum';
import { CloudSyncCredential } from 'app/interfaces/cloudsync-credential.interface';
import { Option } from 'app/interfaces/option.interface';
import { IxSelectWithNewOption } from 'app/modules/forms/ix-forms/components/ix-select/ix-select-with-new-option.directive';
import { IxSelectComponent, IxSelectValue } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { SlideInResponse } from 'app/modules/slide-ins/slide-in.interface';
import { ignoreTranslation, TranslatedString } from 'app/modules/translate/translate.helper';
import { CloudCredentialsFormComponent } from 'app/pages/credentials/backup-credentials/cloud-credentials-form/cloud-credentials-form.component';
import { CloudCredentialService } from 'app/services/cloud-credential.service';

@Component({
  selector: 'ix-cloud-credentials-select',
  templateUrl: './cloud-credentials-select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CloudCredentialsSelectComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IxSelectComponent],
})
export class CloudCredentialsSelectComponent extends IxSelectWithNewOption {
  readonly label = input<TranslatedString>();
  readonly tooltip = input<TranslatedString>();
  readonly required = input<boolean>(false);
  readonly filterByProviders = input<CloudSyncProviderName[]>();

  private cloudCredentialService = inject(CloudCredentialService);

  fetchOptions(): Observable<Option[]> {
    return this.cloudCredentialService.getCloudSyncCredentials().pipe(
      map((options) => {
        const filterByProviders = this.filterByProviders();
        if (filterByProviders) {
          options = options.filter((option) => filterByProviders.includes(option.provider.type));
        }
        return options.map((option) => {
          return {
            label: ignoreTranslation(`${option.name} (${cloudSyncProviderNameMap.get(option.provider.type)})`),
            value: option.id,
          };
        });
      }),
    );
  }

  getValueFromSlideInResponse(result: SlideInResponse<CloudSyncCredential>): IxSelectValue {
    return result.response.id;
  }

  getFormComponentType(): ComponentType<CloudCredentialsFormComponent> {
    return CloudCredentialsFormComponent;
  }

  override getFormInputData(): { providers: CloudSyncProviderName[] } | undefined {
    const providers = this.filterByProviders();
    return providers?.length ? { providers } : undefined;
  }
}
