import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  errorMessage: string = '';

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.errorMessage = 'Por favor ingresa un correo válido.';
      return;
    }

    this.authService.requestPasswordReset(this.forgotPasswordForm.value.email).subscribe(
      () => {
        alert('Correo enviado con éxito. Revisa tu bandeja de entrada.');
        this.router.navigate(['/login']);
      },
      (error) => {
        console.error('Error al enviar correo:', error);
        this.errorMessage = 'No se pudo enviar el correo. Intenta de nuevo.';
      }
    );
  }
}
