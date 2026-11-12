describe('async', () => {
  it('awaits cy', async () => { // expect: TL010
    await cy.visit('/'); // expect: TL010
    cy.get('[data-cy=title]').should('have.text', 'Home');
  });

  it('stores a chainer', () => {
    const button = cy.get('[data-cy=save]'); // expect: TL010
    button.click();
    cy.get('[data-cy=status]').should('have.text', 'Saved');
  });
});
