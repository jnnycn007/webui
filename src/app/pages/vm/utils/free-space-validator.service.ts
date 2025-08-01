import { Injectable, inject } from '@angular/core';
import { FormGroup, ValidationErrors } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { buildNormalizedFileSize } from 'app/helpers/file-size.utils';
import { IxValidatorsService } from 'app/modules/forms/ix-forms/services/ix-validators.service';
import { ApiService } from 'app/modules/websocket/api.service';

/**
 * Creates an async validator that checks if there is enough free space for the selected datastore.
 * - Designed to be applied to a form.
 * - Assumes that there `datastore` and `volsize` controls present.
 * - Will add errors to `volsize` control.
 *
 * TODO: Feels weird to be setting up errors on control manually.
 * TODO: We should probably be able to show errors on the form itself.
 */
@Injectable({ providedIn: 'root' })
export class FreeSpaceValidatorService {
  private api = inject(ApiService);
  private validators = inject(IxValidatorsService);
  private translate = inject(TranslateService);

  private freeSpaceInPath$: Observable<number>;
  private previousPath: string;

  validate = (form: FormGroup): Observable<ValidationErrors | null> => {
    const { datastore, volsize } = form.value as { datastore: string; volsize: number };
    const path = `/mnt/${datastore}`;

    if (!datastore) {
      return of(null);
    }

    const freeSpaceInPath$ = this.getFreeSpaceInPath(path);

    return freeSpaceInPath$.pipe(
      // TODO: Refactor to fix linter rule.
      // eslint-disable-next-line sonarjs/no-invariant-returns
      map((freeSpace): ValidationErrors | null => {
        this.previousPath = path;
        form.controls.volsize.setErrors(null);

        if (freeSpace > volsize) {
          return null;
        }

        form.controls.volsize.setErrors(
          this.makeError(freeSpace),
        );

        return null;
      }),
    );
  };

  private getFreeSpaceInPath(path: string): Observable<number> {
    if (!this.freeSpaceInPath$ || this.previousPath !== path) {
      this.freeSpaceInPath$ = this.api.call('filesystem.statfs', [path]).pipe(
        map((stat) => stat.free_bytes),
        shareReplay({
          refCount: false,
          bufferSize: 1,
        }),
      );
      this.previousPath = path;
    }

    return this.freeSpaceInPath$;
  }

  private makeError(freeSpace: number): ValidationErrors {
    return this.validators.makeErrorMessage(
      'invalidFreeSpace',
      this.translate.instant('Not enough free space. Maximum available: {space}', {
        space: buildNormalizedFileSize(freeSpace),
      }),
    );
  }
}
