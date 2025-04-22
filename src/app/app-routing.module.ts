import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { SedesComponent } from './pages/sedes/sedes.component';
import { DetalleSedeComponent } from './pages/detalle-sede/detalle-sede.component';
import { TrabajadoresComponent } from './pages/trabajadores/trabajadores.component';
import { DetalleTrabajadorComponent } from './pages/detalle-trabajador/detalle-trabajador.component';
import { CalendarioLaboralComponent } from './pages/calendario-laboral/calendario-laboral.component';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' }, // 🔥 Redirige a login
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent},
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard]},
  { path: 'admin-dashboard', component: AdminDashboardComponent, canActivate: [AuthGuard] },
  { path: 'sedes', component: SedesComponent, canActivate: [AuthGuard] },
  { path: 'sedes/:id', component: DetalleSedeComponent, canActivate: [AuthGuard]},
  { path: 'trabajadores', component: TrabajadoresComponent, canActivate: [AuthGuard]},
  { path: 'trabajadores/:id', component: DetalleTrabajadorComponent, canActivate: [AuthGuard] },
  { path: 'calendario-laboral', component: CalendarioLaboralComponent, canActivate: [AuthGuard] },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent},
  { path: '**', redirectTo: 'login' } // 🔥 Cualquier ruta desconocida también va al login
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
