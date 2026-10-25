import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
  arrowDownCircleOutline,
  arrowUpCircleOutline,
  bagAddOutline,
  barChartOutline,
  barcodeOutline,
  businessOutline,
  cameraOutline,
  cartOutline,
  cloudUploadOutline,
  cubeOutline,
  downloadOutline,
  folderOutline,
  gitCompareOutline,
  homeOutline,
  imagesOutline,
  layersOutline,
  moonOutline,
  personCircleOutline,
  phonePortraitOutline,
  pricetagOutline,
  receiptOutline,
  settingsOutline,
  sunnyOutline,
  swapVerticalOutline,
  trashOutline,
  walletOutline,
  warningOutline,
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
      arrowDownCircleOutline,
      arrowUpCircleOutline,
      bagAddOutline,
      barChartOutline,
      barcodeOutline,
      businessOutline,
      cameraOutline,
      cartOutline,
      cloudUploadOutline,
      cubeOutline,
      downloadOutline,
      folderOutline,
      gitCompareOutline,
      homeOutline,
      imagesOutline,
      layersOutline,
      moonOutline,
      personCircleOutline,
      phonePortraitOutline,
      pricetagOutline,
      receiptOutline,
      settingsOutline,
      sunnyOutline,
      swapVerticalOutline,
      trashOutline,
      walletOutline,
      warningOutline,
    });
  }
}
