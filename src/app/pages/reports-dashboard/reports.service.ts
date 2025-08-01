import { Injectable, inject } from '@angular/core';
import {
  map, Observable, shareReplay, BehaviorSubject, Subject,
} from 'rxjs';
import { ReportingGraphName } from 'app/enums/reporting.enum';
import { Option } from 'app/interfaces/option.interface';
import { ReportingGraph } from 'app/interfaces/reporting-graph.interface';
import { ReportingData } from 'app/interfaces/reporting.interface';
import { ApiService } from 'app/modules/websocket/api.service';
import { ReportTab, reportTypeLabels, ReportType } from 'app/pages/reports-dashboard/interfaces/report-tab.interface';
import { LegendDataWithStackedTotalHtml, Report } from 'app/pages/reports-dashboard/interfaces/report.interface';
import { convertAggregations, optimizeLegend } from 'app/pages/reports-dashboard/utils/report.utils';

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private api = inject(ApiService);

  private reportingGraphs$ = new BehaviorSubject<ReportingGraph[]>([]);
  private diskMetrics$ = new BehaviorSubject<Option[]>([]);
  private hasUps = false;
  private hasDiskTemperature = false;

  private legendEventEmitter$ = new Subject<LegendDataWithStackedTotalHtml>();
  readonly legendEventEmitterObs$ = this.legendEventEmitter$.asObservable();

  constructor() {
    this.api.call('reporting.netdata_graphs').subscribe((reportingGraphs) => {
      this.hasUps = reportingGraphs.some((graph) => graph.name.startsWith(ReportingGraphName.Ups));
      this.reportingGraphs$.next(reportingGraphs);
    });

    this.api.call('disk.temperatures').subscribe((values) => {
      this.hasDiskTemperature = Boolean(Object.values(values).filter(Boolean).length);
    });
  }

  emitLegendEvent(data: LegendDataWithStackedTotalHtml): void {
    this.legendEventEmitter$.next(data);
  }

  getNetData(
    queryData: {
      report: Report;
      params: { name: string; identifier?: string };
      timeFrame: { start: number; end: number };
      truncate: boolean;
    },
  ): Observable<ReportingData> {
    return this.api.call(
      'reporting.netdata_get_data',
      [[queryData.params], queryData.timeFrame],
    ).pipe(
      map((reportingData: ReportingData[]) => reportingData[0]),
      map((reportingData) => {
        // Deep clone the object to avoid modifying read-only properties
        const clonedData = {
          ...reportingData,
          aggregations: reportingData.aggregations
            ? {
                min: Array.isArray(reportingData.aggregations.min)
                  ? [...reportingData.aggregations.min]
                  : reportingData.aggregations.min,
                mean: Array.isArray(reportingData.aggregations.mean)
                  ? [...reportingData.aggregations.mean]
                  : reportingData.aggregations.mean,
                max: Array.isArray(reportingData.aggregations.max)
                  ? [...reportingData.aggregations.max]
                  : reportingData.aggregations.max,
              }
            : undefined,
        };
        if (queryData.truncate && clonedData.data) {
          clonedData.data = this.truncateData(clonedData.data as number[][]);
        }
        return clonedData;
      }),
      map((reportingData) => optimizeLegend(reportingData)),
      map((reportingData) => convertAggregations(reportingData, queryData.report.vertical_label || '')),
    ) as Observable<ReportingData>;
  }

  truncateData(data: number[][]): number[][] {
    let finished = false;
    let index = data.length - 1;
    do {
      // True only when all the values are null
      const isEmpty = !data[index].reduce((acc, i) => {
        // Treat zero as a value
        const value = i !== null ? 1 : i;
        return acc + value;
      });

      if (isEmpty) {
        data.splice(index, 1);
      } else {
        finished = true;
      }
      index--;
    } while (!finished && data.length > 0);

    return data;
  }

  getReportTabs(): ReportTab[] {
    return Array.from(reportTypeLabels)
      .filter(([value]) => {
        if (value === ReportType.Ups && !this.hasUps) {
          return false;
        }

        return true;
      })
      .map(([value, label]) => {
        return { value, label } as ReportTab;
      });
  }

  getDiskDevices(): Observable<Option[]> {
    return this.api.call('disk.query').pipe(
      map((disks) => {
        return disks
          .filter((disk) => !disk.devname.includes('multipath'))
          .map((disk) => {
            return { label: disk.devname, value: disk.devname };
          })
          .sort((a, b) => a.label.localeCompare(b.label));
      }),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  getReportGraphs(): Observable<ReportingGraph[]> {
    return this.reportingGraphs$.asObservable();
  }

  setDiskMetrics(options: Option[]): void {
    this.diskMetrics$.next(options);
  }

  getDiskMetrics(): Observable<Option[]> {
    return this.diskMetrics$.asObservable().pipe(
      map((options) => {
        if (!this.hasDiskTemperature) {
          return options.filter((option) => option.value !== 'disktemp');
        }

        return options;
      }),
    );
  }
}
