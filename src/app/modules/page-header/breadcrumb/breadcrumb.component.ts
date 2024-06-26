import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit,
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { chain } from 'lodash';
import { filter } from 'rxjs/operators';
import { RoutePartsService, RoutePart } from 'app/services/route-parts/route-parts.service';

// TODO: Bad. Redo.
const noLinksRoutes = ['/credentials', '/reportsdashboard', '/system'];

@UntilDestroy()
@Component({
  selector: 'ix-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbComponent implements OnInit {
  breadcrumbs: RoutePart[];
  constructor(
    private router: Router,
    private routePartsService: RoutePartsService,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.breadcrumbs = this.getBreadcrumbs();

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        untilDestroyed(this),
      ).subscribe(() => {
        this.breadcrumbs = this.getBreadcrumbs();
        this.cdr.markForCheck();
      });
  }

  private getBreadcrumbs(): RoutePart[] {
    return chain(this.routePartsService.routeParts)
      .sort((a, b) => a.ngUrl.length - b.ngUrl.length)
      .uniqBy('url')
      .filter((routePart) => {
        routePart.ngUrl = routePart.ngUrl.filter((item) => item !== '');
        if (routePart.url === this.router.url) {
          return false;
        }
        return Boolean(routePart.breadcrumb);
      })
      .map((routePart) => {
        if (noLinksRoutes.some((url) => routePart.url === url)) {
          return { ...routePart, url: null };
        }
        return routePart;
      })
      .value();
  }
}
