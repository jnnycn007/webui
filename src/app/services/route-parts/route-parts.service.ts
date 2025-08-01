import { Injectable, inject } from '@angular/core';
import {
  ActivatedRoute, NavigationEnd, Router,
} from '@angular/router';
import { filter } from 'rxjs/operators';

export interface RoutePart {
  title: string;
  breadcrumb: string;
  url: string | null;
  ngUrl?: string[];
  isNew?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class RoutePartsService {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);

  private fullRouteParts: RoutePart[] | null;

  constructor() {
    // only execute when routechange
    this.fullRouteParts = this.generateRouteParts(this.activatedRoute.root);
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
    ).subscribe(() => {
      this.fullRouteParts = this.generateRouteParts(this.activatedRoute.root);
    });
  }

  private generateRouteParts(route: ActivatedRoute, url = '', routeParts: RoutePart[] = []): RoutePart[] | null {
    const children: ActivatedRoute[] = route.children;
    const ngUrl: string[] = [];

    if (children.length === 0) {
      return routeParts;
    }

    for (const child of children) {
      const routeUrl: string = child.snapshot.url.map((segment) => segment.path).join('/');
      if (routeUrl) {
        url += `/${routeUrl}`;
        ngUrl.push(url);
      }

      const { title, breadcrumb, isNew } = child.snapshot.data as RoutePart;

      routeParts.push({
        title,
        breadcrumb,
        url,
        ngUrl,
        isNew,
      });

      this.generateRouteParts(child, url, routeParts);
    }

    return routeParts;
  }

  get routeParts(): RoutePart[] | null {
    return this.fullRouteParts;
  }
}
