import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, input, OnInit, output, signal, Signal, viewChild, inject } from '@angular/core';
import { MatCard } from '@angular/material/card';
import { MatCalendar } from '@angular/material/datepicker';
import { MatTooltip } from '@angular/material/tooltip';
import {
  autocompletion, closeBrackets, CompletionContext, startCompletion,
} from '@codemirror/autocomplete';
import { Diagnostic, linter } from '@codemirror/lint';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import {
  EditorView, keymap, placeholder,
} from '@codemirror/view';
import { TranslateModule } from '@ngx-translate/core';
import { format } from 'date-fns';
import { FilterPreset, QueryFilters } from 'app/interfaces/query-api.interface';
import { FilterPresetsComponent } from 'app/modules/forms/search-input/components/filter-presets/filter-presets.component';
import { AdvancedSearchAutocompleteService } from 'app/modules/forms/search-input/services/advanced-search-autocomplete.service';
import { QueryParserService } from 'app/modules/forms/search-input/services/query-parser/query-parser.service';
import { QueryParsingError } from 'app/modules/forms/search-input/services/query-parser/query-parsing-result.interface';
import { QueryToApiService } from 'app/modules/forms/search-input/services/query-to-api/query-to-api.service';
import { SearchProperty } from 'app/modules/forms/search-input/types/search-property.interface';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { TestDirective } from 'app/modules/test-id/test.directive';

const setDiagnostics = StateEffect.define<Diagnostic[] | null>();

@Component({
  selector: 'ix-advanced-search',
  templateUrl: './advanced-search.component.html',
  styleUrls: ['./advanced-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTooltip,
    IxIconComponent,
    MatCard,
    MatCalendar,
    TestDirective,
    TranslateModule,
    AsyncPipe,
    FilterPresetsComponent,
  ],
})
export class AdvancedSearchComponent<T> implements OnInit {
  private queryParser = inject<QueryParserService<T>>(QueryParserService);
  private queryToApi = inject<QueryToApiService<T>>(QueryToApiService);
  private advancedSearchAutocomplete = inject<AdvancedSearchAutocompleteService<T>>(AdvancedSearchAutocompleteService);
  private cdr = inject(ChangeDetectorRef);

  readonly query = input<QueryFilters<T>>([]);
  readonly filterPresets = input<FilterPreset<T>[]>([]);
  readonly properties = input<SearchProperty<T>[]>([]);
  readonly placeholder = input('');

  readonly paramsChange = output<QueryFilters<T>>();
  readonly switchToBasic = output();
  readonly runSearch = output();

  private readonly inputArea: Signal<ElementRef<HTMLElement>> = viewChild.required('inputArea', { read: ElementRef });

  protected hasQueryErrors = false;
  protected queryInputValue: string;
  errorMessages: QueryParsingError[] | null = null;
  protected editorView: EditorView;

  protected showDatePicker$ = this.advancedSearchAutocomplete.showDatePicker$;

  get editorHasValue(): boolean {
    return this.editorView?.state?.doc?.length > 0;
  }

  readonly selectedPresetLabels = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.initEditor();
    this.advancedSearchAutocomplete.setProperties(this.properties());
    this.advancedSearchAutocomplete.setEditorView(this.editorView);

    if (this.query()) {
      this.replaceEditorContents(
        this.queryParser.formatFiltersToQuery(this.query(), this.properties()),
      );
    }
  }

  startSuggestionsCompletion(): void {
    startCompletion(this.editorView);
  }

  initEditor(): void {
    const updateListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) {
        return;
      }

      this.onInputChanged();
    });

    const diagnosticField = StateField.define({
      create(): Diagnostic[] {
        return [] as Diagnostic[];
      },
      update(diagnostics, transaction): Diagnostic[] {
        for (const effect of transaction.effects) {
          if (effect.is(setDiagnostics)) {
            return effect.value;
          }
        }
        return diagnostics;
      },
    });

    const advancedSearchLinter = linter((view) => view.state.field(diagnosticField));

    const autocompleteExtension = autocompletion({
      override: [(context: CompletionContext) => this.advancedSearchAutocomplete.getCompletions(context)],
      icons: false,
    });

    const customKeyMap = keymap.of([{
      key: 'Enter',
      run: () => {
        this.runSearch.emit();
        return true;
      },
    }]);

    this.editorView = new EditorView({
      state: EditorState.create({
        extensions: [
          autocompleteExtension,
          updateListener,
          advancedSearchLinter,
          diagnosticField,
          customKeyMap,
          EditorView.lineWrapping,
          closeBrackets(),
          placeholder(this.placeholder()),
        ],
      }),
      parent: this.inputArea().nativeElement,
    });

    this.focusInput();
  }

  hideDatePicker(): void {
    this.showDatePicker$.next(false);
  }

  dateSelected(value: string): void {
    this.appendEditorContents(`"${format(new Date(value), 'yyyy-MM-dd')}" `);
    this.focusInput();
    this.hideDatePicker();
  }

  applyPreset(filters: QueryFilters<T>[], presetLabels: Set<string>): void {
    this.selectedPresetLabels.set(new Set(presetLabels));

    const currentQuery = this.editorView.state.doc.toString().trim();
    const newFilters = filters.flat();
    const updatedQuery = this.smartMergePresetFilters(currentQuery, newFilters);

    this.replaceEditorContents(updatedQuery);
  }

  private smartMergePresetFilters(currentQuery: string, newFilters: QueryFilters<T>): string {
    if (!currentQuery.trim()) {
      return this.queryParser.formatFiltersToQuery(newFilters, this.properties());
    }

    const parsedQuery = this.queryParser.parseQuery(currentQuery);
    if (parsedQuery.hasErrors) {
      const presetQuery = this.queryParser.formatFiltersToQuery(newFilters, this.properties());
      return `${currentQuery} AND ${presetQuery}`;
    }

    const currentFilters = this.queryToApi.buildFilters(parsedQuery, this.properties());

    const newFilterProperties = new Set<string>();
    newFilters.forEach((filter) => {
      if (Array.isArray(filter) && filter.length === 3) {
        const [property] = filter;
        newFilterProperties.add(String(property));
      }
    });

    const nonConflictingFilters = currentFilters.filter((filter) => {
      if (Array.isArray(filter) && filter.length === 3) {
        const [property] = filter;
        return !newFilterProperties.has(String(property));
      }
      return true;
    });

    const mergedFilters = [...nonConflictingFilters, ...newFilters];
    return this.queryParser.formatFiltersToQuery(mergedFilters, this.properties());
  }

  protected onResetInput(): void {
    this.replaceEditorContents('');
    this.focusInput();
    this.hideDatePicker();
    this.paramsChange.emit([]);
    this.selectedPresetLabels.set(new Set());
    this.runSearch.emit();
  }

  private focusInput(): void {
    this.editorView.focus();
  }

  private onInputChanged(): void {
    this.queryInputValue = this.editorView.state.doc.toString();
    const parsedQuery = this.queryParser.parseQuery(this.queryInputValue);

    queueMicrotask(() => {
      this.hasQueryErrors = Boolean(this.queryInputValue.length && parsedQuery.hasErrors);
      this.cdr.markForCheck();
      this.cdr.detectChanges();

      this.recalculateActivePresetsFromRawQuery(this.queryInputValue);

      if (parsedQuery.hasErrors && this.queryInputValue?.length) {
        this.errorMessages = parsedQuery.errors;
        this.editorView.dispatch({
          effects: setDiagnostics.of(
            parsedQuery.errors.filter((error) => error.from !== error.to) as Diagnostic[],
          ),
        });
        return;
      }

      this.editorView.dispatch({
        effects: setDiagnostics.of([]),
      });
      this.errorMessages = null;

      const filters = this.queryToApi.buildFilters(parsedQuery, this.properties());
      const mergedFilters = this.mergeConflictingFilters(filters);
      this.paramsChange.emit(mergedFilters);
    });
  }

  private replaceEditorContents(contents: string): void {
    this.editorView.dispatch({
      changes: { from: 0, to: this.editorView.state.doc.length, insert: contents },
      selection: { anchor: contents.length },
    });
  }

  private appendEditorContents(contents: string): void {
    this.editorView.dispatch({
      changes: { from: this.editorView.state.doc.length, insert: contents },
      selection: { anchor: this.editorView.state.doc.length + contents.length },
    });
  }

  private recalculateActivePresetsFromRawQuery(query: string): void {
    const normalizedQuery = this.normalize(query);
    const activeLabels = new Set<string>();

    if (!normalizedQuery || normalizedQuery.length < 2) {
      this.selectedPresetLabels.set(activeLabels);
      return;
    }

    for (const preset of this.filterPresets() || []) {
      const presetFilters = preset.query.map((filter) => {
        return this.normalize(this.queryParser.formatFiltersToQuery([filter], this.properties()));
      });

      const hasPartialMatch = presetFilters.some((filterExpr) => {
        return normalizedQuery.includes(filterExpr) || filterExpr.includes(normalizedQuery);
      });

      if (hasPartialMatch) {
        activeLabels.add(preset.label);
      }
    }

    this.selectedPresetLabels.set(activeLabels);
  }

  private mergeConflictingFilters(filters: QueryFilters<T>): QueryFilters<T> {
    const mergedFilters: QueryFilters<T> = [];
    const propertyMap = new Map<string, { filter: QueryFilters<T>[number]; index: number }>();

    filters.forEach((filter, index) => {
      if (Array.isArray(filter) && filter.length === 3) {
        const [property] = filter;
        const propertyKey = String(property);
        propertyMap.set(propertyKey, { filter, index });
      } else {
        mergedFilters.push(filter);
      }
    });

    const standardFilters = Array.from(propertyMap.values())
      .sort((a, b) => a.index - b.index)
      .map(({ filter }) => filter);

    mergedFilters.push(...(standardFilters as QueryFilters<T>));
    return mergedFilters;
  }

  private normalize(value: string): string {
    return value.replace(/["']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
}
