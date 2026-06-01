import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService, LoginRequest } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  mensagem = '';
  carregando = false;

  loginForm = new FormGroup({
    email: new FormControl(''),
    senha: new FormControl(''),
  });

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  entrar() {
    this.mensagem = '';

    const dados = this.loginForm.getRawValue() as LoginRequest;

    if (!dados.email || !dados.senha) {
      this.mensagem = 'Preencha e-mail e senha.';
      return;
    }

    this.carregando = true;

    this.authService.login(dados).subscribe({
      next: (resposta) => {
        this.carregando = false;
        this.mensagem = resposta.message;

        if (resposta.success) {
          localStorage.setItem('cafefinance_usuario', JSON.stringify(resposta.user));
          this.router.navigate(['/home']);
        }
      },
      error: (erro) => {
        this.carregando = false;
        this.mensagem = erro.error?.message ?? 'Nao foi possivel entrar.';
      },
    });
  }
}
