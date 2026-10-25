import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
  barChartOutline,
  cardOutline,
  cloudUploadOutline,
  downloadOutline,
  homeOutline,
  moonOutline,
  personCircleOutline,
  phonePortraitOutline,
  settingsOutline,
  sunnyOutline,
  swapVerticalOutline,
  trashOutline,
  walletOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    addIcons({
      add,
      barChartOutline,
      cardOutline,
      cloudUploadOutline,
      downloadOutline,
      homeOutline,
      moonOutline,
      personCircleOutline,
      phonePortraitOutline,
      settingsOutline,
      sunnyOutline,
      swapVerticalOutline,
      trashOutline,
      walletOutline,
    });
  }
}
