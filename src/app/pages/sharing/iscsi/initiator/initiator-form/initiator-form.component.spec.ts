import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatListHarness } from '@angular/material/list/testing';
import { Router } from '@angular/router';
import { createRoutingFactory, mockProvider, SpectatorRouting } from '@ngneat/spectator/jest';
import { mockCall, mockApi } from 'app/core/testing/utils/mock-api.utils';
import { mockAuth } from 'app/core/testing/utils/mock-auth.utils';
import { mockWindow } from 'app/core/testing/utils/mock-window.utils';
import { IscsiGlobalSession } from 'app/interfaces/iscsi-global-config.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { IxFormHarness } from 'app/modules/forms/ix-forms/testing/ix-form.harness';
import { DualListBoxComponent } from 'app/modules/lists/dual-listbox/dual-listbox.component';
import { ApiService } from 'app/modules/websocket/api.service';
import { InitiatorFormComponent } from 'app/pages/sharing/iscsi/initiator/initiator-form/initiator-form.component';

describe('InitiatorFormComponent', () => {
  let spectator: SpectatorRouting<InitiatorFormComponent>;
  let loader: HarnessLoader;
  let form: IxFormHarness;
  let api: ApiService;
  const createComponent = createRoutingFactory({
    component: InitiatorFormComponent,
    imports: [
      ReactiveFormsModule,
      DualListBoxComponent,
    ],
    providers: [
      mockAuth(),
      mockWindow({
        navigator: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }),
      mockApi([
        mockCall('iscsi.global.sessions', [{
          initiator: 'inr1',
          initiator_addr: '10.0.0.1',
        }] as IscsiGlobalSession[]),
        mockCall('iscsi.initiator.query', [{ id: 1, comment: 'comment1', initiators: ['inr11', 'inr12'] }]),
        mockCall('iscsi.initiator.create'),
        mockCall('iscsi.initiator.update'),
      ]),
      mockProvider(DialogService),
    ],
  });

  beforeEach(async () => {
    spectator = createComponent();
    loader = TestbedHarnessEnvironment.loader(spectator.fixture);
    form = await loader.getHarness(IxFormHarness);
    api = spectator.inject(ApiService);
  });

  it('shows current initiator values when form is being edited', async () => {
    spectator.setRouteParam('pk', '1');

    const availableList = await loader.getHarness(MatListHarness.with({ selector: '[aria-label="Connected Initiators"]' }));
    const selectedList = await loader.getHarness(MatListHarness.with({ selector: '[aria-label="Allowed Initiators"]' }));

    expect(await availableList.getItems()).toHaveLength(1);
    expect(await selectedList.getItems()).toHaveLength(2);

    expect(api.call).toHaveBeenCalledWith('iscsi.global.sessions');
    expect(api.call).toHaveBeenCalledWith('iscsi.initiator.query', [[['id', '=', 1]]]);

    expect(await form.getValues()).toEqual({
      'Allow All Initiators': false,
      'Add Allowed Initiators (IQN)': '',
      Description: 'comment1',
    });
  });

  it('sends an update payload to websocket and closes modal when Save button is pressed', async () => {
    spectator.setRouteParam('pk', '1');

    const availableList = await loader.getHarness(MatListHarness.with({ selector: '[aria-label="Connected Initiators"]' }));
    const selectedList = await loader.getHarness(MatListHarness.with({ selector: '[aria-label="Allowed Initiators"]' }));

    const available = await availableList.getItems();

    expect(available).toHaveLength(1);
    expect(await selectedList.getItems()).toHaveLength(2);

    await (await available[0].host()).click();

    const addButton = await loader.getHarness(MatButtonHarness.with({ selector: '[ixTest="move-selected-right"]' }));
    await addButton.click();

    expect(await availableList.getItems()).toHaveLength(0);
    expect(await selectedList.getItems()).toHaveLength(3);

    await form.fillForm({
      Description: 'new_comment',
    });

    const saveButton = await loader.getHarness(MatButtonHarness.with({ text: 'Save' }));
    await saveButton.click();

    expect(api.call).toHaveBeenLastCalledWith('iscsi.initiator.update', [1, {
      comment: 'new_comment',
      initiators: ['inr11', 'inr12', 'inr1'],
    }]);
    expect(spectator.inject(Router).navigate).toHaveBeenCalledWith(['/', 'sharing', 'iscsi', 'initiators']);
  });

  it('sends empty initiators when allow all is secected', async () => {
    spectator.setRouteParam('pk', '1');

    await form.fillForm({
      'Allow All Initiators': true,
      Description: 'new_comment',
    });

    const saveButton = await loader.getHarness(MatButtonHarness.with({ text: 'Save' }));
    await saveButton.click();

    expect(api.call).toHaveBeenLastCalledWith('iscsi.initiator.update', [1, {
      comment: 'new_comment',
      initiators: [],
    }]);
    expect(spectator.inject(Router).navigate).toHaveBeenCalledWith(['/', 'sharing', 'iscsi', 'initiators']);
  });

  it('adds a new initiator and closes modal when Save button is pressed', async () => {
    const availableList = await loader.getHarness(MatListHarness.with({ selector: '[aria-label="Connected Initiators"]' }));
    const selectedList = await loader.getHarness(MatListHarness.with({ selector: '[aria-label="Allowed Initiators"]' }));

    expect(await availableList.getItems()).toHaveLength(1);
    expect(await selectedList.getItems()).toHaveLength(0);

    const addNewInitiatorButton = await loader.getHarness(MatButtonHarness.with({ selector: '[ixTest="add-initiator"]' }));

    await form.fillForm({ 'Add Allowed Initiators (IQN)': 'new_initiator_1' });
    await addNewInitiatorButton.click();

    await form.fillForm({ 'Add Allowed Initiators (IQN)': 'new_initiator_2' });
    await addNewInitiatorButton.click();

    expect(await availableList.getItems()).toHaveLength(1);
    expect(await selectedList.getItems()).toHaveLength(2);

    const saveButton = await loader.getHarness(MatButtonHarness.with({ text: 'Save' }));
    await saveButton.click();

    expect(api.call).toHaveBeenLastCalledWith('iscsi.initiator.create', [{
      comment: '',
      initiators: ['new_initiator_1', 'new_initiator_2'],
    }]);
    expect(spectator.inject(Router).navigate).toHaveBeenCalledWith(['/', 'sharing', 'iscsi', 'initiators']);
  });

  it('redirects to Initiator List page when Cancel button is pressed', async () => {
    const button = await loader.getHarness(MatButtonHarness.with({ text: 'Cancel' }));
    await button.click();

    expect(spectator.inject(Router).navigate).toHaveBeenCalledWith(['/', 'sharing', 'iscsi', 'initiators']);
  });

  it('loads connected initiators when Refresh button is pressed', async () => {
    const button = await loader.getHarness(MatButtonHarness.with({ text: 'Refresh' }));
    await button.click();

    expect(api.call).toHaveBeenLastCalledWith('iscsi.global.sessions');
  });
});
