import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class SvgCacheService {
  private http = inject(HttpClient);

  private cache = new Map<string, string>();

  loadSvg(url: string): Observable<string> {
    const cachedSvg = this.cache.get(url);
    if (cachedSvg) {
      return of(cachedSvg);
    }

    return this.http.get(url, { responseType: 'text' }).pipe(
      tap((svg) => this.cache.set(url, svg)),
    );
  }
}
