import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService, CadastroRequest } from '../../services/auth.service';

@Component({
  selector: 'app-cadastro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './cadastro.html',
  styleUrl: './cadastro.css',
})
export class Cadastro {
  mensagem = '';
  carregando = false;

  cadastroForm = new FormGroup({
    name: new FormControl(''),
    email: new FormControl(''),
    password: new FormControl(''),
    confirmarSenha: new FormControl(''),
  });

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  cadastro() {
    this.mensagem = '';

    const dados = this.cadastroForm.getRawValue() as CadastroRequest;

    if (!dados.name || !dados.email || !dados.password || !dados.confirmarSenha) {
      this.mensagem = 'Preencha todos os campos.';
      return;
    }

    if (dados.password !== dados.confirmarSenha) {
      this.mensagem = 'As senhas precisam ser iguais.';
      return;
    }

    this.carregando = true;

    this.authService.registrar(dados).subscribe({
      next: (resposta) => {
        this.carregando = false;
        this.mensagem = resposta.message;

        if (resposta.success) {
          if (resposta.user) {
            localStorage.setItem('cafefinance_usuario', JSON.stringify(resposta.user));
          }

          this.cadastroForm.reset();
          this.router.navigate(['/perfil']);
        }
      },
      error: (erro) => {
        this.carregando = false;
        this.mensagem = erro.error?.message ?? 'Não foi possível cadastrar.';
      },
    });
  }
}
