import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatList, MatListItem } from '@angular/material/list';
import { MatToolbarRow } from '@angular/material/toolbar';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Actions, ofType } from '@ngrx/effects';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import ipRegex from 'ip-regex';
import { combineLatest, filter } from 'rxjs';
import { UiSearchDirective } from 'app/directives/ui-search.directive';
import { NetworkActivityType } from 'app/enums/network-activity-type.enum';
import { NetworkConfiguration } from 'app/interfaces/network-configuration.interface';
import { NetworkSummary } from 'app/interfaces/network-summary.interface';
import { Option } from 'app/interfaces/option.interface';
import { searchDelayConst } from 'app/modules/global-search/constants/delay.const';
import { UiSearchDirectivesService } from 'app/modules/global-search/services/ui-search-directives.service';
import { IxIconComponent } from 'app/modules/ix-icon/ix-icon.component';
import { CastPipe } from 'app/modules/pipes/cast/cast.pipe';
import { SlideIn } from 'app/modules/slide-ins/slide-in';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { NetworkConfigurationComponent } from 'app/pages/system/network/components/network-configuration/network-configuration.component';
import {
  networkConfigurationCardElements,
} from 'app/pages/system/network/components/network-configuration-card/network-configuration-card.elements';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';
import { networkInterfacesChanged } from 'app/store/network-interfaces/network-interfaces.actions';

@UntilDestroy()
@Component({
  selector: 'ix-network-configuration-card',
  templateUrl: './network-configuration-card.component.html',
  styleUrls: ['./network-configuration-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCard,
    MatToolbarRow,
    MatButton,
    TestDirective,
    UiSearchDirective,
    MatCardContent,
    MatList,
    MatListItem,
    IxIconComponent,
    TranslateModule,
    CastPipe,
  ],
})
export class NetworkConfigurationCardComponent implements OnInit {
  private api = inject(ApiService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private slideIn = inject(SlideIn);
  private searchDirectives = inject(UiSearchDirectivesService);
  private actions$ = inject(Actions);
  private errorHandler = inject(ErrorHandlerService);

  protected readonly networkConfigurationCardElements = networkConfigurationCardElements;

  summary: NetworkSummary;
  config: NetworkConfiguration;
  isLoading = false;

  ngOnInit(): void {
    this.loadNetworkConfigAndSummary();

    this.actions$.pipe(ofType(networkInterfacesChanged), untilDestroyed(this))
      .subscribe(() => this.loadNetworkConfigAndSummary());
  }

  get serviceAnnouncement(): string {
    const options: string[] = [];
    if (this.config.service_announcement.netbios) {
      options.push('NETBIOS-NS');
    }
    if (this.config.service_announcement.mdns) {
      options.push('mDNS');
    }
    if (this.config.service_announcement.wsd) {
      options.push('WS-DISCOVERY');
    }

    return options.join(', ');
  }

  get additionalDomains(): string {
    return this.config.domains.length > 0 ? this.config.domains.join(', ') : '-';
  }

  get outboundNetwork(): string {
    if (this.config.activity.activities.length === 0) {
      if (this.config.activity.type === NetworkActivityType.Allow) {
        return this.translate.instant('Deny All');
      }

      return this.translate.instant('Allow All');
    }

    if (this.config.activity.type === NetworkActivityType.Allow) {
      return this.translate.instant(
        'Only allow: {activities}',
        { activities: this.config.activity.activities.join(', ') },
      );
    }

    return this.translate.instant(
      'Allow all except: {activities}',
      { activities: this.config.activity.activities.join(', ') },
    );
  }

  get nameservers(): Option[] {
    const nameservers: Option[] = [];
    const nameserverAttributes = ['nameserver1', 'nameserver2', 'nameserver3'] as const;
    const labels = [
      this.translate.instant('Primary'),
      this.translate.instant('Secondary'),
      this.translate.instant('Tertiary'),
    ];

    nameserverAttributes.forEach((attribute, index) => {
      const nameserver = this.config[attribute];
      if (nameserver) {
        nameservers.push({
          label: this.translate.instant(labels[index]),
          value: nameserver,
        });
      }
    });

    this.summary.nameservers.forEach((nameserver) => {
      if (nameserverAttributes.some((attribute) => this.config[attribute] === nameserver)) {
        return;
      }

      nameservers.push({
        label: this.translate.instant('Nameserver (DHCP)'),
        value: nameserver,
      });
    });

    return nameservers;
  }

  get ipv4(): string[] {
    return this.summary.default_routes.filter((item) => ipRegex.v4().test(item));
  }

  get ipv6(): string[] {
    return this.summary.default_routes.filter((item) => ipRegex.v6().test(item));
  }

  onSettingsClicked(): void {
    this.slideIn.open(NetworkConfigurationComponent, { wide: true }).pipe(
      filter((response) => !!response.response),
      untilDestroyed(this),
    ).subscribe(() => this.loadNetworkConfigAndSummary());
  }

  private loadNetworkConfigAndSummary(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    combineLatest([
      this.api.call('network.general.summary'),
      this.api.call('network.configuration.config'),
    ])
      .pipe(
        this.errorHandler.withErrorHandler(),
        untilDestroyed(this),
      )
      .subscribe(([summary, config]) => {
        this.isLoading = false; // TODO: Add loading indication in UI.
        this.summary = summary;
        this.config = config;
        setTimeout(() => this.handlePendingGlobalSearchElement(), searchDelayConst * 2);

        this.cdr.markForCheck();
      });
  }

  private handlePendingGlobalSearchElement(): void {
    const pendingHighlightElement = this.searchDirectives.pendingUiHighlightElement;

    if (pendingHighlightElement) {
      this.searchDirectives.get(pendingHighlightElement)?.highlight(pendingHighlightElement);
    }
  }
}
