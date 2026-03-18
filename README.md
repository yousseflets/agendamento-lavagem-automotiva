# P

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.2.11.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

Uso / configuração rápida

- Este projeto implementa em Angular um formulário de agendamento com:
	- seleção de serviço (cards)
	- modal com dados: Nome, Telefone, E-mail, Serviço, Data e Horário
	- persistência dos agendamentos em `localStorage`
	- bloqueio do mesmo horário para a mesma data
	- envio automático de notificação por e-mail usando EmailJS (cliente)

Configurar EmailJS (necessário para envio automático):

1. Crie uma conta em https://www.emailjs.com/
2. Crie um `service` (ex.: gmail) e um `template` com variáveis: `name`, `phone`, `email`, `service`, `date`, `time`.
3. Copie `service_id`, `template_id` e `user_id` (ou public key).
4. No arquivo `src/environments/environment.ts`, substitua os placeholders em `emailJs` por esses valores.

Observações:
- O projeto usa `localStorage` para manter agendamentos; para produção recomendo um backend + banco de dados para validação e segurança.
- Enviar credenciais sensíveis para repositórios públicos não é recomendado. Use variáveis de ambiente ou um backend seguro em produção.

