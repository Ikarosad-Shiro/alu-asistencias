import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm: FormGroup;
  token: string = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {
    this.resetPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordsMatchValidator
    });
  }
  ngOnInit(): void {
    // ✅ Corregido: Tomamos el token de los query params
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
  }
  passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordsMismatch: true };
  }

  onSubmit(): void {
    if (this.resetPasswordForm.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos inválidos',
        text: 'Verifica que ambas contraseñas coincidan y tengan al menos 6 caracteres.',
        timer: 3000,
        timerProgressBar: true,
        showConfirmButton: false
      });
      return;
    }

    const { password } = this.resetPasswordForm.value;

    this.authService.resetPasswordConfirm(this.token, password).subscribe(
      () => {
        Swal.fire({
          icon: 'success',
          title: '¡Contraseña actualizada!',
          text: 'Ahora puedes iniciar sesión con tu nueva contraseña.',
          showConfirmButton: false,
          timer: 2500,
          timerProgressBar: true,
          backdrop:`r rgba(0,0,123,0.4)
        url("https://sweetalert2.github.io/images/nyan-cat.gif")
        left top
        no-repeat
        `

        }).then(() => {
          this.router.navigate(['/login']);
        });
      },
      () => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'El enlace expiró o el token no es válido.',
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false
        });
      }
    );
  }
}
