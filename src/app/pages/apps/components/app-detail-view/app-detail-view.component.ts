import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { untilDestroyed, UntilDestroy } from '@ngneat/until-destroy';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  Gallery, GalleryItem, GalleryModule, ImageItem,
} from 'ng-gallery';
import { LightboxModule } from 'ng-gallery/lightbox';
import { ImgFallbackModule } from 'ngx-img-fallback';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { injectParams } from 'ngxtension/inject-params';
import {
  map, filter, switchMap,
} from 'rxjs';
import { appImagePlaceholder } from 'app/constants/catalog.constants';
import { AvailableApp } from 'app/interfaces/available-app.interface';
import { PageHeaderComponent } from 'app/modules/page-header/page-title-header/page-header.component';
import { AppAvailableInfoCardComponent } from 'app/pages/apps/components/app-detail-view/app-available-info-card/app-available-info-card.component';
import { AppDetailsHeaderComponent } from 'app/pages/apps/components/app-detail-view/app-details-header/app-details-header.component';
import { AppDetailsSimilarComponent } from 'app/pages/apps/components/app-detail-view/app-details-similar/app-details-similar.component';
import { AppJsonDetailsCardComponent } from 'app/pages/apps/components/app-detail-view/app-json-details-card/app-json-details-card.component';
import { AppResourcesCardComponent } from 'app/pages/apps/components/app-detail-view/app-resources-card/app-resources-card.component';
import { AppsStore } from 'app/pages/apps/store/apps-store.service';

@UntilDestroy()
@Component({
  selector: 'ix-app-detail-view',
  templateUrl: './app-detail-view.component.html',
  styleUrls: ['./app-detail-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    AppDetailsHeaderComponent,
    TranslateModule,
    NgxSkeletonLoaderModule,
    ImgFallbackModule,
    AppDetailsSimilarComponent,
    AppResourcesCardComponent,
    NgTemplateOutlet,
    AppAvailableInfoCardComponent,
    AppJsonDetailsCardComponent,
    LightboxModule,
    GalleryModule,
  ],
})
export class AppDetailViewComponent implements OnInit {
  private activatedRoute = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private applicationsStore = inject(AppsStore);
  private gallery = inject(Gallery);
  private router = inject(Router);

  readonly app = signal<AvailableApp | null>(null);
  readonly appId = injectParams('appId');
  readonly train = injectParams('train');
  readonly isLoading = signal(true);
  readonly imagePlaceholder = appImagePlaceholder;
  readonly items = signal<GalleryItem[]>([]);

  pageTitle = computed<string>(() => {
    const app = this.app();
    return app?.title || app?.name || this.translate.instant('...');
  });

  constructor() {
    effect(() => {
      if (this.appId() && this.train()) {
        this.loadAppInfo();
      }
    });
  }

  ngOnInit(): void {
    this.setLightbox();
  }

  private loadAppInfo(): void {
    this.isLoading.set(true);
    this.applicationsStore.isLoading$.pipe(
      filter((isLoading) => !isLoading),
      switchMap(() => {
        return this.applicationsStore.availableApps$.pipe(
          map((apps: AvailableApp[]) => {
            const appId = this.appId();
            const train = this.train();
            return apps.find((app) => app.name === appId && app.train === train);
          }),
        );
      }),
    ).pipe(untilDestroyed(this)).subscribe({
      next: (app) => {
        this.isLoading.set(false);

        if (!app) {
          this.router.navigate(['/apps/installed']);
        } else {
          this.app.set(app);
        }
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  private setLightbox(): void {
    const app = this.app();
    const images = app?.screenshots?.map((image) => new ImageItem({ src: image, thumb: image }));
    if (!images) {
      return;
    }

    this.items.set(images);
    this.gallery.ref('lightbox').load(this.items());
  }
}
