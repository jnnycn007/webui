import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatListItemHarness } from '@angular/material/list/testing';
import { createComponentFactory, mockProvider, Spectator } from '@ngneat/spectator/jest';
import { of } from 'rxjs';
import { mockAuth } from 'app/core/testing/utils/mock-auth.utils';
import { Device } from 'app/interfaces/device.interface';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import {
  IsolatedGpusCardComponent,
} from 'app/pages/system/advanced/isolated-gpus/isolated-gpus-card/isolated-gpus-card.component';
import {
  IsolatedGpusFormComponent,
} from 'app/pages/system/advanced/isolated-gpus/isolated-gpus-form/isolated-gpus-form.component';
import { FirstTimeWarningService } from 'app/services/first-time-warning.service';
import { GpuService } from 'app/services/gpu/gpu.service';

describe('IsolatedGpusCardComponent', () => {
  let spectator: Spectator<IsolatedGpusCardComponent>;
  let loader: HarnessLoader;
  const createComponent = createComponentFactory({
    component: IsolatedGpusCardComponent,
    providers: [
      mockAuth(),
      mockProvider(GpuService, {
        getIsolatedGpus: jest.fn(() => of([
          { description: 'Matrox G200' } as Device,
        ])),
      }),
      mockProvider(FirstTimeWarningService, {
        showFirstTimeWarningIfNeeded: jest.fn(() => of(true)),
      }),
      mockProvider(SlideIn, {
        open: jest.fn(() => of({ response: true })),
      }),
    ],
  });

  beforeEach(() => {
    spectator = createComponent();
    loader = TestbedHarnessEnvironment.loader(spectator.fixture);
  });

  it('shows currently isolated GPUs', async () => {
    const isolatedGpus = await loader.getHarness(MatListItemHarness);
    expect(await isolatedGpus.getFullText()).toBe('Isolated GPU Device(s): Matrox G200');
  });

  it('opens Isolated GPU form when Configure is pressed', async () => {
    const configureButton = await loader.getHarness(MatButtonHarness.with({ text: 'Configure' }));
    await configureButton.click();

    expect(spectator.inject(FirstTimeWarningService).showFirstTimeWarningIfNeeded).toHaveBeenCalled();
    expect(spectator.inject(SlideIn).open).toHaveBeenCalledWith(IsolatedGpusFormComponent);
  });
});
