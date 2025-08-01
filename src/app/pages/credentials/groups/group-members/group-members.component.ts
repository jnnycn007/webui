import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatCard, MatCardTitle, MatCardContent, MatCardActions,
} from '@angular/material/card';
import { MatProgressBar } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateModule } from '@ngx-translate/core';
import { forkJoin, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { RequiresRolesDirective } from 'app/directives/requires-roles/requires-roles.directive';
import { Role } from 'app/enums/role.enum';
import { Group } from 'app/interfaces/group.interface';
import { User } from 'app/interfaces/user.interface';
import { AuthService } from 'app/modules/auth/auth.service';
import { ReadOnlyComponent } from 'app/modules/forms/ix-forms/components/readonly-badge/readonly-badge.component';
import { iconMarker } from 'app/modules/ix-icon/icon-marker.util';
import { DualListBoxComponent } from 'app/modules/lists/dual-listbox/dual-listbox.component';
import { TestDirective } from 'app/modules/test-id/test.directive';
import { ApiService } from 'app/modules/websocket/api.service';
import { ErrorHandlerService } from 'app/services/errors/error-handler.service';

@UntilDestroy()
@Component({
  selector: 'ix-group-members',
  templateUrl: './group-members.component.html',
  styleUrls: ['./group-members.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DualListBoxComponent,
    MatCard,
    MatProgressBar,
    MatCardTitle,
    ReadOnlyComponent,
    MatCardContent,
    MatCardActions,
    RequiresRolesDirective,
    MatButton,
    TestDirective,
    TranslateModule,
    AsyncPipe,
  ],
})
export class GroupMembersComponent implements OnInit {
  private api = inject(ApiService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private errorHandler = inject(ErrorHandlerService);
  private authService = inject(AuthService);

  protected readonly requiredRoles = [Role.AccountWrite];
  protected readonly iconMarker = iconMarker;
  protected selectedMembers: User[] = [];
  protected readonly users = signal<User[]>([]);

  protected readonly isLoading = signal(false);
  protected readonly group = signal<Group | null>(null);

  get hasRequiredRoles(): Observable<boolean> {
    return this.authService.hasRole(this.requiredRoles);
  }

  ngOnInit(): void {
    this.isLoading.set(true);
    this.activatedRoute.params.pipe(
      switchMap((params) => forkJoin([
        this.api.call('group.query', [[['id', '=', parseInt(params.pk as string)]]]),
        this.api.call('user.query', [[['local', '=', true]]]),
      ])),
      untilDestroyed(this),
    ).subscribe(([groups, users]) => {
      const group = groups[0];
      this.group.set(group);
      this.users.set(users);
      this.selectedMembers = users.filter((user) => group.users.includes(user.id));
      this.isLoading.set(false);
    });
  }

  onCancel(): void {
    this.router.navigate(['/', 'credentials', 'groups']);
  }

  onSubmit(): void {
    this.isLoading.set(true);

    const userIds = this.selectedMembers.map((user) => user.id);
    this.api.call('group.update', [this.group().id, { users: userIds }]).pipe(
      untilDestroyed(this),
    ).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/', 'credentials', 'groups']);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.errorHandler.showErrorModal(error);
      },
    });
  }
}
