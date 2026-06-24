import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkPermission } from '../permissions.ts'

describe('checkPermission', () => {

  describe('admin role', () => {
    it('allows create', () => {
      assert.ok(checkPermission('admin', 'Employees', 'create', { name: 'Test' }))
    })

    it('allows update', () => {
      assert.ok(checkPermission('admin', 'Employees', 'update', { name: 'Test' }))
    })

    it('allows delete', () => {
      assert.ok(checkPermission('admin', 'Employees', 'delete'))
    })

    it('allows all operations on any cube', () => {
      assert.ok(checkPermission('admin', 'Productivity', 'create'))
      assert.ok(checkPermission('admin', 'Departments', 'update'))
      assert.ok(checkPermission('admin', 'Skills', 'delete'))
    })
  })

  describe('editor role', () => {
    it('allows create on permitted cube', () => {
      assert.ok(checkPermission('editor', 'Employees', 'create', { name: 'Test' }))
    })

    it('allows update on permitted cube', () => {
      assert.ok(checkPermission('editor', 'Employees', 'update', { name: 'Test' }))
    })

    it('denies delete on permitted cube', () => {
      assert.ok(!checkPermission('editor', 'Employees', 'delete'))
    })

    it('denies access to non-permitted cube', () => {
      assert.ok(!checkPermission('editor', 'Departments', 'create'))
    })

    it('denies write to denied field', () => {
      assert.ok(!checkPermission('editor', 'Employees', 'create', { email: 'spam@x.com' }))
    })

    it('allows write to permitted fields', () => {
      assert.ok(checkPermission('editor', 'Employees', 'create', { name: 'Test', isActive: true }))
    })

    it('denies write to denied field alongside permitted fields', () => {
      assert.ok(!checkPermission('editor', 'Employees', 'update', { name: 'Test', email: 'hacked@x.com' }))
    })

    it('denies update on non-permitted cube', () => {
      assert.ok(!checkPermission('editor', 'Offices', 'update'))
    })
  })

  describe('viewer role', () => {
    it('denies all mutations', () => {
      assert.ok(!checkPermission('viewer', 'Employees', 'create'))
      assert.ok(!checkPermission('viewer', 'Employees', 'update'))
      assert.ok(!checkPermission('viewer', 'Employees', 'delete'))
    })
  })

  describe('unauthenticated', () => {
    it('denies when role is undefined', () => {
      assert.ok(!checkPermission(undefined, 'Employees', 'create'))
    })

    it('denies when role is empty string', () => {
      assert.ok(!checkPermission('', 'Employees', 'create'))
    })
  })

  describe('unknown role', () => {
    it('denies all operations', () => {
      assert.ok(!checkPermission('superadmin', 'Employees', 'create'))
    })
  })

})
