describe('banner', () => {
  it('checks the banner when it shows up', () => {
    cy.visit('/');
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy=banner]').length) { // expect: TL008
        cy.get('[data-cy=banner]').should('have.text', 'Sale');
      }
    });
    cy.get('[data-cy=title]').should('have.text', 'Home');
  });
});
