import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Componentes
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { TrabajadoresComponent } from './pages/trabajadores/trabajadores.component';
import { CalendarioComponent } from './components/calendario/calendario.component';
import { DetalleTrabajadorComponent } from './pages/detalle-trabajador/detalle-trabajador.component';
import { CalendarioLaboralComponent } from './pages/calendario-laboral/calendario-laboral.component';
import { CalendarioSedeComponent } from './components/calendario-sede/calendario-sede.component';

// Formularios y Material
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

// 🗓️ Angular Calendar
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { CalendarCommonModule } from 'angular-calendar';

// Servicios
import { AuthService } from './services/auth.service';

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
    CalendarioComponent,
    DetalleTrabajadorComponent,
    CalendarioLaboralComponent,
    CalendarioSedeComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    HttpClientModule,
    MatSidenavModule,
    MatCardModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatTableModule,
    MatExpansionModule,
    MatSelectModule,
    CommonModule,

    // 🗓️ Angular Calendar
    CalendarModule.forRoot({ provide: DateAdapter, useFactory: adapterFactory }),
    CalendarCommonModule
  ],
  providers: [AuthService],
  bootstrap: [AppComponent]
})
export class AppModule {}
