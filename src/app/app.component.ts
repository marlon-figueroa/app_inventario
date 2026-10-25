import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
  barChartOutline,
  businessOutline,
  cloudUploadOutline,
  cubeOutline,
  downloadOutline,
  folderOutline,
  homeOutline,
  moonOutline,
  personCircleOutline,
  phonePortraitOutline,
  pricetagOutline,
  settingsOutline,
  sunnyOutline,
  swapVerticalOutline,
  trashOutline,
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
      businessOutline,
      cloudUploadOutline,
      cubeOutline,
      downloadOutline,
      folderOutline,
      homeOutline,
      moonOutline,
      personCircleOutline,
      phonePortraitOutline,
      pricetagOutline,
      settingsOutline,
      sunnyOutline,
      swapVerticalOutline,
      trashOutline,
    });
  }
}
