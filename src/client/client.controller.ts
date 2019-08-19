// client.controller

import { Request, Response } from 'express';
import { OAuth2Controller } from '../oauth2/oauth2.controller';
import { IClientBasicInformation, IClientInformation, OAuth2Parser } from '../oauth2/oauth2.parser';
import { ClientRepository } from './client.repository';
import { IClient } from './client.interface';
import { InvalidParameter, NotFound } from '../utils/error';

export class ClientController {

    /**
     * Creates a new client.
     * @param req - Request
     * @param res - Response
     */
    public static async create(req: Request, res: Response) {

        // Gets the client information required for register client in authorization server.
        const clientInformation = req.body.clientInformation as IClientBasicInformation;
        const teamId = req.teamId;
        console.log(clientInformation);
        // If there is clientInformation (data) and there is a teamId, then proceed.
        if (clientInformation && teamId) {
            // Set the all the host uris, to lower case.
            clientInformation.hostUris = clientInformation.hostUris.map(hostUri => hostUri.toLowerCase());

            // Set the client name first digit to uppercase and the other to lower.
            clientInformation.name = clientInformation.name.charAt(0).toUpperCase() +
                                     clientInformation.name.substr(1).toLowerCase();

            // Creates the client in OSpike first
            const registeredClient = await OAuth2Controller.registerClient(clientInformation, teamId);

            // Creates the client in the Spike Server db
            await ClientRepository.create({ teamId, ...registeredClient });

            return res.status(200).send(registeredClient);
        }

        throw new InvalidParameter('Client information or team id parameter is missing.');
    }

    /**
     * Reads client's full information from the authorization server.
     * @param req - Request
     * @param res - Response
     */
    public static async read(req: Request, res: Response) {

        // Gets the client's id to read
        const clientId = req.params.clientId;
        const teamId = req.teamId;

        if (clientId && teamId) {

            // Getting the client registration token associated to the client
            const clientDoc = await ClientRepository.findById(clientId);

            // Checks if the client is unexist or client not associated to the team
            // (we do that to avoid exposing our db to user who performs information gathering attacks)
            if (!clientDoc || clientDoc.teamId !== teamId) {
                throw new InvalidParameter('Client id or team id parameter is invalid');
            }

            return res.status(200).send(await OAuth2Controller.readClientInformation(clientId, clientDoc.token));
        }

        throw new InvalidParameter('Client id or team id parameter is missing.');
    }

    /**
     * Find all clients of a specified team id.
     * @param req - Request
     * @param res - Response
     */

    public static async findByToken(req: Request, res: Response) {
        const id = req.teamId;

        if (id) {
            const returnedClients: IClient[] | null = await ClientRepository.findByTeamId(id);

            if (!returnedClients) {
                throw new NotFound('Clients not found.');
            }

            return res.status(200).send(returnedClients);
        }

        throw new InvalidParameter('id parameter is missing.');
    }

    /**
     * Updates an old client with a new one.
     * @param req - Request
     * @param res - Response
     */
    public static async update(req: Request, res: Response) {

        // Gets the client information required for register client in authorization server
        const clientInformation = req.body.clientInformation as Partial<IClientBasicInformation>;
        const clientId = req.params.clientId;
        const teamId = req.teamId;

        if (Object.keys(clientInformation).length > 0 && clientId && teamId) {

            // Getting the client registration token associated to the client
            const clientDoc = await ClientRepository.findById(clientId);

            // Checks if the client is unexist or client not associated to the team
            // (we do that to avoid exposing our db to user who performs information gathering attacks)
            if (!clientDoc || clientDoc.teamId !== teamId) {
                throw new InvalidParameter('Client id or team id parameter is invalid');
            }

            // If there are hostUris (Data), then set them all to lowercase.
            if (clientInformation.hostUris) {
                clientInformation.hostUris = clientInformation.hostUris.map(hostUri => hostUri.toLowerCase());
            }
            console.log(clientId);
            console.log(clientInformation);
            console.log(clientDoc.token);
            const updatedClient = await OAuth2Controller.updateClientInformation(clientId,
                                                                                 clientInformation,
                                                                                 clientDoc.token);
            // Update the client metadata in client model
            await clientDoc.update(OAuth2Parser.parseClientInfoToModel(updatedClient));

            return res.status(200).send(updatedClient);
        }

        throw new InvalidParameter('Client information or client id or team id is missing.');
    }

    /**
     * Deletes a client by a specified id.
     * @param req - Request
     * @param res - Response
     */
    public static async delete(req: Request, res: Response) {
        const clientId = req.params.clientId;
        const teamId = req.teamId;

        if (clientId && teamId) {

            // Getting the client registration token associated to the client
            const clientDoc = await ClientRepository.findById(clientId);

            // Checks if the client is unexist or client not associated to the team
            // (we do that to avoid exposing our db to user who performs information gathering attacks)
            if (!clientDoc || clientDoc.teamId !== teamId) {
                throw new InvalidParameter('Client id or team id parameter is invalid');
            }

            // First delete the client from OSpike
            await OAuth2Controller.deleteClient(clientId, clientDoc.token);

            // Than if succeed, delete the client from our db
            await clientDoc.remove();

            return res.sendStatus(204);
        }

        throw new InvalidParameter('Client id or team id is missing.');
    }
}
