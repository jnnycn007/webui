import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { IxFormsModule } from 'app/modules/forms/ix-forms/ix-forms.module';
import { IxIconModule } from 'app/modules/ix-icon/ix-icon.module';
import { FilterSelectListComponent } from 'app/pages/apps/modules/custom-forms/components/filter-select-list/filter-select-list.component';

@NgModule({
  imports: [
    IxIconModule,
    IxFormsModule,
    CommonModule,
    TranslateModule,
  ],
  declarations: [
    FilterSelectListComponent,
  ],
  exports: [
    FilterSelectListComponent,
  ],
})
export class CustomFormsModule { }
