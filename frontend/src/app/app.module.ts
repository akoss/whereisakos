import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { MomentModule } from 'ngx-moment';
import { EscapeHtmlPipe } from './pipes/keep-html.pipe';
import { TimeAgoPipe } from 'time-ago-pipe';

import { AppComponent } from './app.component';

import { HttpClientModule } from '@angular/common/http'

import { DataService } from './data.service'


@NgModule({
  declarations: [
    AppComponent,
    EscapeHtmlPipe,
    TimeAgoPipe
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    MomentModule
  ],
  providers: [
    DataService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
