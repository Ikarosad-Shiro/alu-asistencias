import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }
  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Correo inválido',
        text: 'Por favor ingresa un correo válido.',
        timer: 2500,
        timerProgressBar: true,
        showConfirmButton: false
      });
      return;
    }

    this.authService.requestPasswordReset(this.forgotPasswordForm.value.email).subscribe(
      () => {
        Swal.fire({
          icon: 'success',
          title: '¡Correo enviado!',
          text: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/login']);
        });
      },
      (error) => {
        console.error('Error al enviar correo:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error?.message || 'No se pudo enviar el correo. Intenta de nuevo.',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false
        });
      }
    );
  }
}
