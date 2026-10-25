import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';
import {
  documentFolioLabel,
  DOCUMENT_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../core/labels';
import { DocumentWithLines } from '../../core/models';
import { DisplayDatePipe, ProductUnitLabelPipe } from '../../shared/label.pipe';
import { MxnPipe } from '../../shared/mxn.pipe';
import { DocumentService } from './document.service';

@Component({
  selector: 'app-document-detail',
  templateUrl: './document-detail.page.html',
  styleUrls: ['./document-detail.page.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonButton,
    MxnPipe,
    DisplayDatePipe,
    ProductUnitLabelPipe,
  ],
})
export class DocumentDetailPage implements OnInit {
  private documentsApi = inject(DocumentService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  id = input.required<string>();
  doc = signal<DocumentWithLines | null>(null);

  typeLabels = DOCUMENT_TYPE_LABELS;
  paymentLabels = PAYMENT_METHOD_LABELS;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.doc.set(await this.documentsApi.get(this.id()));
  }

  folioLabel(): string {
    const d = this.doc();
    return d ? documentFolioLabel(d.type, d.folio) : '';
  }

  async shareTicket(): Promise<void> {
    const d = this.doc();
    if (!d) {
      return;
    }
    const text = this.documentsApi.formatTicketText(d);
    if (Capacitor.getPlatform() === 'web') {
      if (navigator.share) {
        await navigator.share({ title: this.folioLabel(), text });
      } else {
        await navigator.clipboard.writeText(text);
        const toast = await this.toastCtrl.create({
          message: 'Ticket copiado al portapapeles',
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      }
      return;
    }
    await Share.share({ title: this.folioLabel(), text, dialogTitle: 'Compartir ticket' });
  }

  printTicket(): void {
    const d = this.doc();
    if (!d) {
      return;
    }
    const text = this.documentsApi.formatTicketText(d);
    const win = window.open('', '_blank');
    if (!win) {
      return;
    }
    win.document.write(`<pre style="font-family:monospace;padding:1rem">${text.replaceAll('<', '&lt;')}</pre>`);
    win.document.close();
    win.print();
  }

  async cancelDocument(): Promise<void> {
    const d = this.doc();
    if (!d || d.status === 'cancelled') {
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Cancelar documento',
      message: 'Se revertirá el stock asociado a este documento.',
      inputs: [{ name: 'reason', type: 'text', placeholder: 'Motivo' }],
      buttons: [
        { text: 'Cerrar', role: 'cancel' },
        {
          text: 'Cancelar documento',
          role: 'destructive',
          handler: async (data) => {
            try {
              await this.documentsApi.cancelDocument(d.id, String(data?.['reason'] ?? 'Cancelación'));
              await this.reload();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: error instanceof Error ? error.message : 'No se pudo cancelar',
                duration: 2800,
                color: 'dark',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }
}
