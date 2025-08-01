import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { find } from 'lodash-es';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { ExplorerNodeType } from 'app/enums/explorer-type.enum';
import { ExplorerNodeData } from 'app/interfaces/tree-node.interface';
import { DialogService } from 'app/modules/dialog/dialog.service';
import { TreeNodeProvider } from 'app/modules/forms/ix-forms/components/ix-explorer/tree-node-provider.interface';
import { TranslatedString } from 'app/modules/translate/translate.helper';
import { ApiService } from 'app/modules/websocket/api.service';
import { isRootShare } from 'app/pages/sharing/utils/smb.utils';

@Injectable({ providedIn: 'root' })
export class DatasetService {
  private api = inject(ApiService);
  private dialog = inject(DialogService);
  private translate = inject(TranslateService);


  getDatasetNodeProvider(): TreeNodeProvider {
    return () => {
      return this.api.call('pool.filesystem_choices').pipe(
        map((filesystems) => {
          const nodes: ExplorerNodeData[] = [];
          filesystems.forEach((filesystem) => {
            const pathSegments = filesystem.split('/');
            if (pathSegments.length === 1) {
              nodes.push({
                name: filesystem,
                hasChildren: false,
                path: filesystem,
                type: ExplorerNodeType.Directory,
                children: [],
              });
              return;
            }

            let parent = find(nodes, { name: pathSegments[0] });
            let i = 1;
            while (find(parent.children, { name: pathSegments[i] })) {
              parent = find(parent.children, { name: pathSegments[i++] });
            }

            parent.children.push({
              name: pathSegments[pathSegments.length - 1],
              children: [],
              hasChildren: false,
              type: ExplorerNodeType.Directory,
              path: filesystem,
            });
            parent.hasChildren = true;
          });

          return nodes;
        }),
      );
    };
  }

  rootLevelDatasetWarning(path: string, message: TranslatedString, skip = false): Observable<boolean> {
    return isRootShare(path) && !skip
      ? this.dialog.confirm({
        title: this.translate.instant('Warning'),
        message,
      })
      : of(true);
  }
}
