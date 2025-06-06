import { createServiceFactory, SpectatorService } from '@ngneat/spectator/jest';
import { GiB } from 'app/constants/bytes.constant';
import { DiskType } from 'app/enums/disk-type.enum';
import { CreateVdevLayout, VDevType } from 'app/enums/v-dev-type.enum';
import { PoolManagerTopology } from 'app/pages/storage/modules/pool-manager/store/pool-manager.store';
import {
  GenerateVdevsService,
} from 'app/pages/storage/modules/pool-manager/utils/generate-vdevs/generate-vdevs.service';
import { generateVdevDisks, expectDisks, categorySequence } from 'app/pages/storage/modules/pool-manager/utils/generate-vdevs/test-utils';

describe('GenerateVdevsService - normal cases', () => {
  let spectator: SpectatorService<GenerateVdevsService>;
  const createService = createServiceFactory(GenerateVdevsService);

  beforeEach(() => spectator = createService());

  it('one category across enclosures', () => {
    const vdevs = spectator.service.generateVdevs({
      allowedDisks: generateVdevDisks,
      topology: {
        [VDevType.Data]: {
          diskSize: 5 * GiB,
          width: 2,
          vdevsNumber: 3,
          diskType: DiskType.Hdd,
          layout: CreateVdevLayout.Stripe,
        },
      } as PoolManagerTopology,
      maximizeDispersal: false,
      categorySequence,
    });

    expect(vdevs).toEqual({
      [VDevType.Data]: expectDisks([
        ['enclosure1-disk1', 'enclosure1-disk2'],
        ['enclosure1-disk3', 'enclosure2-disk1'],
        ['enclosure2-disk2', 'enclosure3-disk1'],
      ]),
    });
  });

  it('multiple categories across enclosures (including no enclosure)', () => {
    const vdevs = spectator.service.generateVdevs({
      allowedDisks: generateVdevDisks,
      topology: {
        [VDevType.Data]: {
          diskSize: 5 * GiB,
          width: 2,
          vdevsNumber: 2,
          diskType: DiskType.Hdd,
          layout: CreateVdevLayout.Stripe,
        },
        [VDevType.Log]: {
          diskSize: 5 * GiB,
          width: 1,
          vdevsNumber: 3,
          diskType: DiskType.Hdd,
          layout: CreateVdevLayout.Stripe,
        },
        [VDevType.Spare]: {
          diskSize: 5 * GiB,
          width: 4,
          vdevsNumber: 1,
          diskType: DiskType.Hdd,
          layout: CreateVdevLayout.Stripe,
        },
      } as PoolManagerTopology,
      maximizeDispersal: false,
      categorySequence,
    });

    expect(vdevs).toEqual({
      [VDevType.Data]: expectDisks([
        ['enclosure1-disk1', 'enclosure1-disk2'],
        ['enclosure1-disk3', 'enclosure2-disk1'],
      ]),
      [VDevType.Log]: expectDisks([
        ['enclosure2-disk2'],
        ['enclosure3-disk1'],
        ['enclosure3-disk2'],
      ]),
      [VDevType.Spare]: expectDisks([
        ['enclosure3-disk3', 'enclosure3-disk4', 'enclosure3-disk5', 'no-enclosure-disk1'],
      ]),
    });
  });

  it('multiple categories with different disk types and sizes', () => {
    const vdevs = spectator.service.generateVdevs({
      allowedDisks: generateVdevDisks,
      topology: {
        [VDevType.Cache]: {
          diskSize: 2 * GiB,
          width: 2,
          vdevsNumber: 1,
          diskType: DiskType.Ssd,
          layout: CreateVdevLayout.Stripe,
        },
        [VDevType.Data]: {
          diskSize: 10 * GiB,
          width: 3,
          vdevsNumber: 1,
          diskType: DiskType.Hdd,
          layout: CreateVdevLayout.Stripe,
        },
        [VDevType.Spare]: {
          diskSize: 5 * GiB,
          width: 3,
          vdevsNumber: 1,
          diskType: DiskType.Hdd,
          layout: CreateVdevLayout.Stripe,
        },
      } as PoolManagerTopology,
      maximizeDispersal: false,
      categorySequence,
    });

    expect(vdevs).toEqual({
      [VDevType.Data]: expectDisks([
        ['larger1', 'larger2', 'larger3'],
      ]),
      [VDevType.Spare]: expectDisks([
        ['enclosure1-disk1', 'enclosure1-disk2', 'enclosure1-disk3'],
      ]),
      [VDevType.Cache]: expectDisks([
        ['small-ssd1', 'small-ssd2'],
      ]),
    });
  });
});
