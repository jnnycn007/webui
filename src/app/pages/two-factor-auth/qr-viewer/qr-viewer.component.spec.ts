import 'jest-canvas-mock';
import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { MockComponent, MockModule } from 'ng-mocks';
import { QrCodeComponent, QrCodeDirective, QrCodeModule } from 'ng-qrcode';
import { helptext2fa } from 'app/helptext/system/2fa';
import { WarningComponent } from 'app/modules/forms/ix-forms/components/warning/warning.component';
import { QrViewerComponent } from 'app/pages/two-factor-auth/qr-viewer/qr-viewer.component';

describe('QrViewerComponent', () => {
  let spectator: Spectator<QrViewerComponent>;

  const createComponent = createComponentFactory({
    component: QrViewerComponent,
    imports: [
      MockComponent(WarningComponent),
      QrCodeComponent,
      QrCodeDirective,
      MockModule(QrCodeModule),
    ],
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        qrInfo: '12345',
      },
    });
  });

  it('shows warning message when parent component requires it', () => {
    spectator.setInput('showWarning', true);
    const warning = spectator.query(WarningComponent);
    expect(warning).toBeTruthy();
    expect(warning).toHaveAttribute('message', helptext2fa.qrCodeMessage);
  });

  it('shows qr code', () => {
    const qrCode = spectator.query(QrCodeComponent)!;
    expect(qrCode).toBeTruthy();
    expect(qrCode.size).toBe(200);
  });
});
