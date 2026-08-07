import { RpcClient } from "./rpc";

/**
 * Devices bound to a Tenzro identity, and machine ownership.
 *
 * A Tenzro identity links devices the way a platform account does, except the
 * link is not a platform account. No Apple, Google or Microsoft sign-in is an
 * identity authority here: what the node trusts is a WebAuthn attestation it
 * verifies to a vendor root it pins, so "hardware-bound" is a fact the device
 * proved rather than a claim its cloud account made.
 *
 * A wallet cannot sit behind one device. `walletReadiness` reports whether a
 * second bound device exists yet, and names the remedy when it does not.
 */
export class DeviceClient {
  constructor(private rpc: RpcClient) {}

  /**
   * Bind a device to an identity from a WebAuthn registration.
   *
   * `attestationObjectB64` is the base64 attestation object from
   * `navigator.credentials.create()`. The node parses and grades it against
   * the vendor roots it pins — a device whose key is not in hardware, or whose
   * credential can sync to a cloud account, is refused with the reason.
   */
  async bindDevice(identityDid: string, label: string, attestationObjectB64: string): Promise<any> {
    return this.rpc.call("tenzro_bindDevice", { identity_did: identityDid, label, attestation_object_b64: attestationObjectB64 });
  }

  /** The devices that can authenticate as an identity, and what each proved. */
  async listBoundDevices(identityDid: string): Promise<any> {
    return this.rpc.call("tenzro_listBoundDevices", { identity_did: identityDid });
  }

  /** Unbind a device and end every session it authorised, in one action. */
  async revokeBoundDevice(identityDid: string, credentialId: string): Promise<any> {
    return this.rpc.call("tenzro_revokeBoundDevice", { identity_did: identityDid, credential_id: credentialId });
  }

  /**
   * Whether a wallet may be created for this identity, and if not, why.
   *
   * Read before offering wallet creation so the user is told what to do —
   * "scan the pairing QR with your phone" — rather than shown a button that
   * fails. A wallet cannot sit behind a single device.
   */
  async walletReadiness(identityDid: string, thisDeviceCredentialId?: string): Promise<any> {
    return this.rpc.call("tenzro_walletReadiness", { identity_did: identityDid, this_device_credential_id: thisDeviceCredentialId ?? null });
  }

  /**
   * Move a machine to another identity. `authority` is `"controller"` (with
   * `controllerDid`) for a machine a party delegated, or `"hardware_root"`
   * (with `hardwareRootHex`) for one nobody delegated. The two are not
   * interchangeable.
   */
  async transferMachineOwnership(
    machineDid: string,
    newOwnerDid: string,
    authority: "controller" | "hardware_root",
    controllerDid?: string,
    hardwareRootHex?: string,
  ): Promise<any> {
    return this.rpc.call("tenzro_transferMachineOwnership", {
        machine_did: machineDid,
        new_owner_did: newOwnerDid,
        authority,
        controller_did: controllerDid ?? null,
        hardware_root_hex: hardwareRootHex ?? null,
      });
  }
}
