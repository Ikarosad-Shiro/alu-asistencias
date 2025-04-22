import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Componentes
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { TrabajadoresComponent } from './pages/trabajadores/trabajadores.component';
import { DetalleTrabajadorComponent } from './pages/detalle-trabajador/detalle-trabajador.component';
import { CalendarioLaboralComponent } from './pages/calendario-laboral/calendario-laboral.component';
import { CalendarioSedeComponent } from './components/calendario-sede/calendario-sede.component';
import { CalendarioComponent } from './components/calendario/calendario.component';

// Formularios y Material
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { CommonModule } from '@angular/common';

// Angular Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

// Angular Calendar
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { CalendarMonthModule } from 'angular-calendar';
import { CalendarCommonModule } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';

// Servicios
import { AuthService } from './services/auth.service';
import { AuthInterceptor } from './services/auth.interceptor';
import { SedesComponent } from './pages/sedes/sedes.component';
import { DetalleSedeComponent } from './pages/detalle-sede/detalle-sede.component';

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    RegisterComponent,
    ResetPasswordComponent,
    ForgotPasswordComponent,
    DashboardComponent,
    AdminDashboardComponent,
    TrabajadoresComponent,
    DetalleTrabajadorComponent,
    CalendarioLaboralComponent,
    CalendarioSedeComponent,
    CalendarioComponent,
    SedesComponent,
    DetalleSedeComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    CommonModule,

    // Angular Material
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSidenavModule,
    MatCardModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatTableModule,
    MatExpansionModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDialogModule,
    MatTooltipModule,

    // Angular Calendar
    CalendarModule.forRoot({ provide: DateAdapter, useFactory: adapterFactory }),
    CalendarCommonModule,
    CalendarMonthModule
  ],
  providers: [
    AuthService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule {}
