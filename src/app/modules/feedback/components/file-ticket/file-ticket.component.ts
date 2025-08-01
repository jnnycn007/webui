import { ChangeDetectionStrategy, Component, input, output, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogContent, MatDialogActions } from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { MiB } from 'app/constants/bytes.constant';
import { TicketType, ticketAcceptedFiles } from 'app/enums/file-ticket.enum';
import { helptextSystemSupport as helptext } from 'app/helptext/system/support';
import { OauthButtonType } from 'app/modules/buttons/oauth-button/interfaces/oauth-button.interface';
import { OauthButtonComponent } from 'app/modules/buttons/oauth-button/oauth-button.component';
import { FeedbackDialog } from 'app/modules/feedback/components/feedback-dialog/feedback-dialog.component';
import { SimilarIssuesComponent } from 'app/modules/feedback/components/similar-issues/similar-issues.component';
import { FeedbackType } from 'app/modules/feedback/interfaces/feedback.interface';
import { FeedbackService } from 'app/modules/feedback/services/feedback.service';
import { FormActionsComponent } from 'app/modules/forms/ix-forms/components/form-actions/form-actions.component';
import { IxCheckboxComponent } from 'app/modules/forms/ix-forms/components/ix-checkbox/ix-checkbox.component';
import { IxFileInputComponent } from 'app/modules/forms/ix-forms/components/ix-file-input/ix-file-input.component';
import { IxInputComponent } from 'app/modules/forms/ix-forms/components/ix-input/ix-input.component';
import { IxTextareaComponent } from 'app/modules/forms/ix-forms/components/ix-textarea/ix-textarea.component';
import { FormErrorHandlerService } from 'app/modules/forms/ix-forms/services/form-error-handler.service';
import { ImageValidatorService } from 'app/modules/forms/ix-forms/validators/image-validator/image-validator.service';
import { ApiService } from 'app/modules/websocket/api.service';

@UntilDestroy()
@Component({
  selector: 'ix-file-ticket',
  styleUrls: ['./file-ticket.component.scss'],
  templateUrl: './file-ticket.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogContent,
    ReactiveFormsModule,
    IxInputComponent,
    SimilarIssuesComponent,
    IxTextareaComponent,
    IxCheckboxComponent,
    IxFileInputComponent,
    MatDialogActions,
    FormActionsComponent,
    OauthButtonComponent,
    TranslateModule,
  ],
})
export class FileTicketComponent {
  private formBuilder = inject(FormBuilder);
  private feedbackService = inject(FeedbackService);
  private imageValidator = inject(ImageValidatorService);
  private formErrorHandler = inject(FormErrorHandlerService);
  private api = inject(ApiService);

  readonly type = input.required<FeedbackType.Bug | FeedbackType.Suggestion>();
  readonly dialogRef = input.required<MatDialogRef<FeedbackDialog>>();
  readonly isLoading = input.required<boolean>();

  readonly isLoadingChange = output<boolean>();

  protected form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.maxLength(200)]],
    message: ['', [Validators.maxLength(20000)]],
    images: [[] as File[], []],
    attach_debug: [true],
    attach_images: [false],
    take_screenshot: [true],
  });

  protected OauthButtonType = OauthButtonType;
  protected readonly oauthUrl = 'https://support-proxy.ixsystems.com/oauth/initiate?origin=';
  protected readonly messagePlaceholder = helptext.bug.message.label;
  protected readonly acceptedFiles = ticketAcceptedFiles;

  protected readonly tooltips = {
    title: helptext.title.placeholder,
    attach_debug: helptext.attachDebug.tooltip,
  };

  private get ticketType(): TicketType {
    return this.type() === FeedbackType.Bug ? TicketType.Bug : TicketType.Suggestion;
  }

  constructor() {
    this.getSystemFileSizeLimit();
  }

  onSubmit(token: unknown): void {
    this.isLoadingChange.emit(true);

    this.feedbackService.createTicket(token as string, this.ticketType, this.form.getRawValue()).pipe(
      finalize(() => this.isLoadingChange.emit(false)),
      untilDestroyed(this),
    ).subscribe({
      next: (createdTicket) => this.onSuccess(createdTicket.url),
      error: (error: unknown) => this.formErrorHandler.handleValidationErrors(error, this.form),
    });
  }

  private onSuccess(ticketUrl: string): void {
    this.feedbackService.showTicketSuccessMessage(ticketUrl);
    this.dialogRef().close();
  }

  private getSystemFileSizeLimit(): void {
    this.api.call('support.attach_ticket_max_size').pipe(untilDestroyed(this)).subscribe((size) => {
      this.form.controls.images.addAsyncValidators(this.imageValidator.getImagesValidator(size * MiB));
      this.form.controls.images.updateValueAndValidity();
    });
  }
}
