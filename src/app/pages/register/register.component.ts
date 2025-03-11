import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service'; // Verifica que la ruta sea correcta
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage: string = '';
  registrationSuccess: boolean = false;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.registerForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],  // ✅ Cambiado de fullName a nombre
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordsMatchValidator
    });
  }

  // Validación personalizada para verificar que las contraseñas coincidan
  passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordsMismatch: true };
  }

  // Método para registrar un usuario
  onRegister(): void {
    if (this.registerForm.invalid) {
      this.errorMessage = 'Por favor completa todos los campos correctamente.';
      return;
    }

    // ✅ Enviar solo los datos que el backend necesita
    const userData = {
      nombre: this.registerForm.value.nombre,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password
    };

    this.authService.register(userData).subscribe(
      (response: any) => {
        console.log('Usuario registrado:', response);
        this.registrationSuccess = true;
        this.errorMessage = '';  // 🔥 Limpiar errores previos

        setTimeout(() => {
          this.router.navigate(['/login']); // Redirige después de 2s
        }, 2000);
      },
      (error: any) => {
        console.error('Error al registrar usuario:', error);
        this.errorMessage = error.error?.message || 'Error al registrar el usuario. Intenta de nuevo.';
      }
    );
  }
}
