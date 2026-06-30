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
  mensagemTipo: 'sucesso' | 'erro' = 'erro';
  carregando = false;

  loginForm = new FormGroup({
    email: new FormControl(''),
    password: new FormControl(''),
  });

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  entrar() {
    this.mensagem = '';
    this.mensagemTipo = 'erro';

    const dados = this.loginForm.getRawValue() as LoginRequest;

    if (!dados.email || !dados.password) {
      this.mensagem = 'Preencha todos os campos.';
      this.mensagemTipo = 'erro';
      return;
    }

    this.carregando = true;

    this.authService.login(dados).subscribe({
      next: (resposta) => {
        this.carregando = false;
        this.mensagem = resposta.message;

        if (resposta.success) {
          this.mensagemTipo = 'sucesso';

          if (resposta.user) {
            localStorage.setItem('cafefinance_usuario', JSON.stringify(resposta.user));
          }

          this.loginForm.reset();
          this.router.navigate(['/perfil']);
        }
      },
      error: (erro) => {
        this.carregando = false;
        this.mensagemTipo = 'erro';
        this.mensagem = erro.status === 401 ? 'E-mail ou senha incorretos.' : erro.error?.message ?? 'Não foi possível entrar.';
      },
    });
  }
}
