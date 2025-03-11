import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';
  successMessage: string = ''; // ✅ Mensaje de éxito si el usuario verificó su cuenta

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute // ✅ Detectamos parámetros de la URL
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]], // ✅ Correo electrónico
      password: ['', [Validators.required, Validators.minLength(6)]] // ✅ Mínimo 6 caracteres
    });
  }

  ngOnInit() {
    // 🔥 Revisamos si viene el parámetro `verified=true` en la URL (verificación exitosa)
    this.route.queryParams.subscribe(params => {
      if (params['verified'] === 'true') {
        this.successMessage = "✅ Cuenta verificada con éxito. Espera a que un administrador te dé acceso.";
      } else if (params['alreadyVerified'] === 'true') {
        this.successMessage = "⚠️ Tu cuenta ya había sido verificada.";
      }
    });
  }

  // 🔥 Método para iniciar sesión
  onLogin() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Por favor, completa todos los campos correctamente.';
      return;
    }

    this.authService.login(this.loginForm.value).subscribe(
      (response: any) => {
        console.log('✅ Inicio de sesión exitoso:', response);

        // ✅ Guardamos el token, rol y nombre del usuario en `localStorage`
        localStorage.setItem('token', response.token);
        localStorage.setItem('rol', response.usuario.rol);
        localStorage.setItem('nombre', response.usuario.nombre); // 🔥 Se usa en el Dashboard

        // 🔥 Redirigir a TODOS al mismo Dashboard
        this.router.navigate(['/dashboard']);
      },
      (error: any) => {
        console.error('❌ Error al iniciar sesión:', error);
        this.errorMessage = error.error?.message || 'Credenciales incorrectas.';
      }
    );
  }
}
