import { marker as T } from '@biesbjerg/ngx-translate-extract-marker';
import { DiskPowerLevel } from 'app/enums/disk-power-level.enum';
import { DiskStandby } from 'app/enums/disk-standby.enum';

export const helptextDisks = {
  generalTitle: T('General'),
  powerManagementTitle: T('Power Management'),
  sedTitle: T('SED'),

  standbyTooltip: T('Minutes of inactivity before the drive enters standby mode. Temperature monitoring is disabled for standby disks.'),

  standbyOptions: [
    { label: T('Always On'), value: DiskStandby.AlwaysOn },
    { label: '5', value: DiskStandby.Minutes5 },
    { label: '10', value: DiskStandby.Minutes10 },
    { label: '20', value: DiskStandby.Minutes20 },
    { label: '30', value: DiskStandby.Minutes30 },
    { label: '60', value: DiskStandby.Minutes60 },
    { label: '120', value: DiskStandby.Minutes120 },
    { label: '180', value: DiskStandby.Minutes180 },
    { label: '240', value: DiskStandby.Minutes240 },
    { label: '300', value: DiskStandby.Minutes300 },
    { label: '330', value: DiskStandby.Minutes330 },
  ],

  advancedPowerManagementOptions: [
    { label: T('Disabled'), value: DiskPowerLevel.Disabled },
    { label: T('Level 1 - Minimum power usage with Standby (spindown)'), value: DiskPowerLevel.Level1 },
    { label: T('Level 64 - Intermediate power usage with Standby'), value: DiskPowerLevel.Level64 },
    { label: T('Level 127 - Maximum power usage with Standby'), value: DiskPowerLevel.Level127 },
    { label: T('Level 128 - Minimum power usage without Standby (no spindown)'), value: DiskPowerLevel.Level128 },
    { label: T('Level 192 - Intermediate power usage without Standby'), value: DiskPowerLevel.Level192 },
    { label: T('Level 254 - Maximum performance, maximum power usage'), value: DiskPowerLevel.Level254 },
  ],

  passwordTooltip: T('Set or change the password of this SED. \
 This password is used instead of the global SED password.'),

  bulkEdit: {
    title: T('Disks'),
    label: T('Settings'),
    disks: {
      tooltip: T('Device names of each disk being edited.'),
    },
    serial: {
      tooltip: T('Serial numbers of each disk being edited.'),
    },
  },

  errorDialogTitle: T('Error updating disks'),

  wipeMethodTooltip: T('<i>Quick</i> erases only the partitioning information\
 on a disk without clearing other old data. <i>Full\
 with zeros</i> overwrites the entire disk with zeros.\
 <i>Full with random data</i> overwrites the entire\
 disk with random binary data.'),

  diskWipeDialogForm: {
    infoContent: T('Disk Wiped successfully'),
  },
};
