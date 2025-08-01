import { AsyncPipe } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, input, OnChanges, OnInit, Signal, viewChild, inject } from '@angular/core';
import { ControlValueAccessor, NgControl, ReactiveFormsModule } from '@angular/forms';
import { MatHint } from '@angular/material/form-field';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, Extension } from '@codemirror/state';
import {
  EditorView, EditorViewConfig, keymap, lineNumbers, placeholder,
} from '@codemirror/view';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { material } from '@uiw/codemirror-theme-material';
import { basicSetup } from 'codemirror';
import {
  BehaviorSubject, Observable, combineLatest, filter, take, tap,
} from 'rxjs';
import { languageFunctionsMap } from 'app/constants/language-functions-map.constant';
import { CodeEditorLanguage } from 'app/enums/code-editor-language.enum';
import { IxSimpleChanges } from 'app/interfaces/simple-changes.interface';
import { IxErrorsComponent } from 'app/modules/forms/ix-forms/components/ix-errors/ix-errors.component';
import { IxLabelComponent } from 'app/modules/forms/ix-forms/components/ix-label/ix-label.component';
import { IxSelectValue } from 'app/modules/forms/ix-forms/components/ix-select/ix-select.component';
import { registeredDirectiveConfig } from 'app/modules/forms/ix-forms/directives/registered-control.directive';
import { TestOverrideDirective } from 'app/modules/test-id/test-override/test-override.directive';
import { TranslatedString } from 'app/modules/translate/translate.helper';

@UntilDestroy()
@Component({
  selector: 'ix-code-editor',
  templateUrl: './ix-code-editor.component.html',
  styleUrls: ['./ix-code-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IxLabelComponent,
    IxErrorsComponent,
    MatHint,
    ReactiveFormsModule,
    AsyncPipe,
    TestOverrideDirective,
  ],
  hostDirectives: [
    { ...registeredDirectiveConfig },
  ],
})
export class IxCodeEditorComponent implements OnChanges, OnInit, AfterViewInit, ControlValueAccessor {
  protected controlDirective = inject(NgControl);
  private cdr = inject(ChangeDetectorRef);

  readonly label = input<TranslatedString>();
  readonly hint = input<TranslatedString>();
  readonly required = input<boolean>(false);
  readonly tooltip = input<TranslatedString>();
  readonly language = input<CodeEditorLanguage>();
  readonly placeholder = input<TranslatedString>('');

  afterViewInit$ = new BehaviorSubject<boolean>(false);

  editableCompartment = new Compartment();

  isDisabled = false;

  protected isDisabled$ = new BehaviorSubject<boolean>(false);
  protected editorReady$ = new BehaviorSubject<boolean>(false);

  readonly inputArea: Signal<ElementRef<HTMLElement>> = viewChild.required('inputArea', { read: ElementRef });

  editorView: EditorView;

  protected value$ = new BehaviorSubject<string>('');

  get disabledState$(): Observable<boolean> {
    return this.isDisabled$.asObservable();
  }

  constructor() {
    this.controlDirective.valueAccessor = this;
  }

  ngOnChanges(changes: IxSimpleChanges<this>): void {
    if (changes.language?.currentValue) {
      this.afterViewInit$.pipe(
        filter(Boolean),
        take(1),
        tap(() => {
          this.initEditor();
          this.editorReady$.next(true);
        }),
        untilDestroyed(this),
      ).subscribe();
    }
  }

  ngOnInit(): void {
    this.handleDisableState();
    this.handleValueUpdate();
  }

  private handleDisableState(): void {
    combineLatest([
      this.editorReady$.pipe(filter(Boolean)),
      this.isDisabled$,
      this.afterViewInit$.pipe(filter(Boolean)),
    ]).pipe(untilDestroyed(this)).subscribe({
      next: ([, isDisabled]) => {
        this.editorView.dispatch({
          effects: this.editableCompartment.reconfigure(EditorView.editable.of(!isDisabled)),
        });
      },
    });
  }

  private handleValueUpdate(): void {
    combineLatest([
      this.editorReady$.pipe(filter(Boolean)),
      this.value$,
      this.afterViewInit$.pipe(filter(Boolean)),
    ]).pipe(untilDestroyed(this)).subscribe({
      next: ([, value]) => {
        this.updateValue(value);
      },
    });
  }

  ngAfterViewInit(): void {
    this.afterViewInit$.next(true);
  }

  initEditor(): void {
    const updateListener = EditorView.updateListener.of((update) => {
      const updatedValue = update.state.doc.toString();

      if (!update.docChanged || updatedValue === this.controlDirective.control?.value) {
        return;
      }

      this.onChange(updatedValue);
    });

    const extensions: Extension[] = [
      basicSetup,
      updateListener,
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap as unknown[], ...historyKeymap]),
      material,
      this.editableCompartment.of(EditorView.editable.of(true)),
      placeholder(this.placeholder()),
    ];

    const language = this.language();
    if (language) {
      extensions.push(languageFunctionsMap[language]());
    }

    const config: EditorViewConfig = {
      extensions,
      doc: this.controlDirective.control?.value as string || '',
      parent: this.inputArea().nativeElement,
    };
    this.editorView = new EditorView(config);
  }

  onChange: (value: string) => void = (): void => {};
  onTouch: () => void = (): void => {};

  writeValue(val: string): void {
    this.value$.next(val);
  }

  updateValue(val: string): void {
    const transaction = this.editorView.state.update({
      changes: {
        from: 0,
        to: this.editorView.state.doc.length,
        insert: val,
      },
    });

    if (transaction) {
      this.editorView.dispatch(transaction);
    }
    this.cdr.markForCheck();
  }

  registerOnChange(onChange: (value: IxSelectValue) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouch = onTouched;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled$.next(isDisabled);
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }
}
