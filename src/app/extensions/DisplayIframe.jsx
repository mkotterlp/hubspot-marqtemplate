import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, RadioButton, Icon, Flex, Box, Heading, Image, Input, Dropdown, Link, Button, ButtonRow, Table, Form, TableHead, TableHeader, TableCell, TableBody, TableRow, Text, Divider, EmptyState, LoadingSpinner, hubspot } from "@hubspot/ui-extensions";
import { CrmActionButton, CrmActionLink, CrmCardActions, CrmAssociationTable } from '@hubspot/ui-extensions/crm';

hubspot.extend(({ context, actions, runServerlessFunction }) => (
  <Extension context={context} actions={actions} runServerless={runServerlessFunction} />
));

const Extension = ({ context, actions, runServerless }) => {
  const [iframeUrl, setIframeUrl] = useState('');
  const [marquserid, setMarquserid] = useState('');
  const [isPolling, setIsPolling] = useState(false);


  const [showTemplates, setShowTemplates] = useState(true);
  const [apiKey, setAPIkey] = useState('');
  const [accessToken, setAccessToken] = useState(null);
  const [authurl, setauth] = useState('');
  const [templates, setTemplates] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [fulltemplatelist, setfullTemplates] = useState([]);
  const [isIframeOpen, setIframeOpen] = useState(false);
  const [title, setTitle] = useState('Relevant Content');
  const [stageName, setStage] = useState('');
  const [propertiesToWatch, setpropertiesToWatch] = useState([]);
  const [objectType, setObjectType] = useState('');
  const [initialFilteredTemplates, setInitialFilteredTemplates] = useState([]);
  const [config, setConfig] = useState({});
  const [fieldsArray, setFieldsArray] = useState([]);
  const [filtersArray, setFiltersArray] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'none' });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dataFetched, setDataFetched] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [lastModifiedDate, setLastModifiedDate] = useState('');
  const hasInitialized = useRef(false);
  const RECORDS_PER_PAGE = 10;
  const [hoveredRow, setHoveredRow] = useState(null);
  const [crmProperties, setCrmProperties] = useState({});
  const [shouldPollForProjects, setShouldPollForProjects] = useState(false); // New state for polling
  const [prevProjectCount, setPrevProjectCount] = useState(0);
  const previousProjectCountRef = useRef(projects.length); 
  const pollingTimerRef = useRef(null);
  const [hasSyncedOnce, setHasSyncedOnce] = useState(false);



  let propertiesBody = {}; 
  let configData = {};
  let templateLink;
  let currentRefreshToken = "";
  let lastTemplateSyncDate;
  // let marquserid

  

  const fetchObjectType = async () => {
    try {
      const objectTypeResponse = await runServerless({
        name: 'objectType',
        parameters: { objectTypeId: context.crm.objectTypeId }
      });

      if (objectTypeResponse && objectTypeResponse.response && objectTypeResponse.response.body) {
        const objectTypeResponseBody = JSON.parse(objectTypeResponse.response.body);
        setObjectType(objectTypeResponseBody.objectType);
      } else {
        console.error("Error: Response body is undefined or not structured as expected.", objectTypeResponse);
      }
    } catch (error) {
      console.error("Error fetching object type:", error);
    }
  };




 
  const fetchPropertiesAndLoadConfig = async (objectType) => {
    try {
      setIsLoading(true);
  
      const userid = context.user.id;
  
      // Validate that userid is available before proceeding
      if (!userid) {
        console.error("Error: Missing user ID.");
        setIsLoading(false);
        return;
      }
  
      // Fetch user data from the 'marqouathhandler' serverless function
      try {
        setIsLoading(true);
        const createusertable = await runServerless({
          name: 'marqouathhandler',
          parameters: { userID: userid }
        });
  
        if (createusertable?.response?.body) {
          const responseBody = JSON.parse(createusertable.response.body);
          const userData = responseBody.row?.values || {}; // Access values directly from row
          lastTemplateSyncDate = userData.lastTemplateSyncDate;
          console.log('lastTemplateSyncDate', lastTemplateSyncDate);
          templateLink = userData.templatesfeed;
          const marquserid = userData.marqUserID;
          // const marquserid = userData.marqUserID;

          currentRefreshToken = userData.refreshToken;

          console.log("Fetched User Data:", JSON.stringify(userData));
          // setRefreshToken(currentRefreshToken)
          // Validate required values before proceeding with further operations
          if (!currentRefreshToken || !marquserid) {
            setIsLoading(false);
            setShowTemplates(false);
            return;
          }
  
          setMarquserid(marquserid);

          const currentTime = Date.now();
          const timeDifference = currentTime - lastTemplateSyncDate;
          const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
  
          // Fetch templates if template link is missing
          if (((timeDifference > twentyFourHoursInMs) && currentRefreshToken) || (!templateLink && currentRefreshToken)) {
            console.log("More than 24 hours since the last sync or template link is null, fetching new templates...");

            setIsLoading(true);
            try {
            
              const fetchResult = await runServerless({
                name: 'fetchTemplates',
                parameters: { 
                  userID: userid,
                  marquserid: marquserid,
                  refreshToken: currentRefreshToken 
                }
              });
              setIsLoading(true);
              
              // Log the full response object
              console.log("Full fetchResult from serverless function:", JSON.stringify(fetchResult, null, 2));
              
              if (fetchResult && fetchResult.response) {
                const statusCode = fetchResult.response.statusCode;
              
                if (statusCode === 200 && fetchResult.response.body) {
                  try {
                    const fetchedData = JSON.parse(fetchResult.response.body);
                    
                    // Check if the required data is present
                    if (fetchedData.templatesjsonurl && fetchedData.newRefreshToken) {
                      templateLink = fetchedData.templatesjsonurl;
                      currentRefreshToken = fetchedData.newRefreshToken;
              
                      console.log("Success! Fetched new template link:", templateLink);
                      console.log("Success! Fetched new refresh token:", currentRefreshToken);
                    } else {
                      console.error("Error: Missing expected data in response body.", fetchedData);
                      templateLink = '';
                      currentRefreshToken = '';
                    }
                  } catch (jsonError) {
                    console.error("Error parsing JSON response:", jsonError, fetchResult.response.body);
                    templateLink = '';
                    currentRefreshToken = '';
                  }
                } else {
                  // Handle non-200 status codes
                  console.error("Failed to fetch new template link. Status Code:", statusCode, "Response body:", fetchResult.response.body);
                  templateLink = '';
                  currentRefreshToken = '';
                }
              } else {
                // Handle missing response
                console.error("Error: fetchResult or response is undefined or malformed.", fetchResult);
                templateLink = '';
                currentRefreshToken = '';
              }
              
              
              

              try {
                setIsLoading(true);
                const updateResult = await runServerless({
                  name: 'updateUserTable',
                  parameters: {
                    userID: userid,
                    refreshToken: currentRefreshToken,
                    templatesJsonUrl: templateLink,
                  }
                });
              } catch (updateError) {
                console.error("Error occurred while trying to update HubDB:", updateError);
              }

            } catch (fetchError) {
              console.error("Error occurred while fetching new template link:", fetchError);
            }
          }
  
          console.log("Fetched Template Link:", JSON.stringify(templateLink));
        } else {
          console.error("Failed to create or fetch user table.");
          console.error('Unexpected structure in createusertable:', JSON.stringify(createusertable));
        }
      } catch (userTableError) {
        console.error("Error occurred while fetching user table:", userTableError);
      }
  
      // Validate that objectType is available
      if (!objectType) {
        console.error("Error: Missing objectType.");
        setIsLoading(false);
        return;
      }
  
      // Fetch config data from 'hubdbHelper'
      try {
        setIsLoading(true);
        const configDataResponse = await runServerless({
          name: 'hubdbHelper',
          parameters: { objectType }
        });
  
        if (configDataResponse?.response?.body) {
          configData = JSON.parse(configDataResponse.response.body).values || {};
          const fields = configData.textboxFields?.split(',').map(field => field.trim()) || [];
          const filters = configData.textboxFilters?.split(',').map(filter => filter.trim()) || [];
          setFieldsArray(fields);
          setFiltersArray(filters);
  
          const propertiesToWatch = configData.textboxFields ? configData.textboxFields.split(',').map(field => field.trim()) : [];
          setpropertiesToWatch(propertiesToWatch);
  
          // Fetch CRM properties if fields are available
          if (fields.length > 0) {
            try {
              const propertiesResponse = await runServerless({
                name: 'getObjectProperties',
                parameters: { objectId: context.crm.objectId, objectType, properties: fields }
              });
  
              if (propertiesResponse?.response?.body) {
                propertiesBody = JSON.parse(propertiesResponse.response.body).mappedProperties || {};
                if (objectType === 'DEAL') {
                  setStage(propertiesBody.dealstage);
                }
              } else {
                console.error("Failed to fetch CRM properties:", propertiesResponse);
              }
            } catch (propertiesError) {
              console.error("Error occurred while fetching CRM properties:", propertiesError);
            }
          }

          
          // Fetch templates from 'fetchJsonData'
          if (templateLink) {
            console.log('applying templates')

            try {
              setIsLoading(true);
              const templatesResponse = await runServerless({
                name: 'fetchJsonData',
                parameters: { templateLink }
              });
  
              if (templatesResponse?.response?.body) {
                const data = JSON.parse(templatesResponse.response.body);
                const fetchedTemplates = data.templatesresponse || [];
                setfullTemplates(fetchedTemplates);
  
                if (fields.length && filters.length && Object.keys(propertiesBody).length > 0) {
                  const filtered = fetchedTemplates.filter(template => {
                    return fields.every((field, index) => {
                      const categoryName = filters[index];
                      const propertyValue = propertiesBody[field]?.toLowerCase();
                      const category = template.categories.find(c => c.category_name.toLowerCase() === categoryName.toLowerCase());
                      return category && category.values.map(v => v.toLowerCase()).includes(propertyValue);
                    });
                  });
                  setFilteredTemplates(filtered.length > 0 ? filtered : fetchedTemplates);
                  setInitialFilteredTemplates(filtered.length > 0 ? filtered : fetchedTemplates);
                } else {
                  setTemplates(fetchedTemplates);
                  setFilteredTemplates(fetchedTemplates);
                }
              } else {
                console.error("Error fetching templates:", templatesResponse);
              }
            } catch (templatesError) {
              console.error("Error occurred while fetching templates:", templatesError);
            }
          } else {
            console.error("Error: Missing template link to fetch templates.");

            if (currentRefreshToken) {
              console.log('Refresh token', currentRefreshToken)
              setShowTemplates(true);
            } else {
              console.log('Missing refresh token', currentRefreshToken)
              setShowTemplates(false);
              setIsLoading(false);
              actions.addAlert({
                title: "Error with template sync",
                variant: "danger",
                message: `There was an error fetching templates. Please try connecting to Marq again`
              });
            }
          }
        } else {
          console.error("Failed to load config data:", configDataResponse);
        }
      } catch (configError) {
        console.error("Error occurred while fetching config data:", configError);
      }
  
      setIsLoading(false);
    } catch (error) {
      console.error("Error in fetchConfigCrmPropertiesAndTemplates:", error);
      setIsLoading(false);
    }
  };
  



  const filterTemplates = (allTemplates, searchTerm, fieldsArray, filtersArray, properties) => {
    let filtered = Array.isArray(allTemplates) ? allTemplates : [];

    // Dynamically extract filters
    const categoryFilters = extractFiltersFromProperties(fieldsArray, filtersArray, properties);

    // Apply category filters with additional logic to include templates without certain filters
    filtered = filtered.filter(template =>
        categoryFilters.every(filter =>
            Array.isArray(template.categories) && template.categories.some(category =>
                (category.category_name === filter.name && category.values.includes(filter.value)) ||
                (category.category_name === filter.name && category.values.length === 0) // Include templates with no values for the category
            )
        )
    );

    // Apply search filter (searching within all templates)
    if (searchTerm) {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(template =>
            template?.title?.toLowerCase().includes(lowerCaseSearchTerm)
        );
    }

    if (filtered.length === 0) {
      filtered = allTemplates; 
  }




    setFilteredTemplates(filtered);
    setTotalPages(Math.ceil(filtered.length / RECORDS_PER_PAGE));
    setCurrentPage(1); // Reset to first page
};

  





const deleteRecord = async (recordId, objectType) => {
  try {
    await runServerless({
      name: 'deleteRecord',
      parameters: { recordId, objectType }
    });

    // Remove the deleted record from the projects state
    setProjects((prevProjects) => {
      const updatedProjects = prevProjects.filter(project => project.objectId !== recordId);
      
      // Update the previous project count reference after deletion
      previousProjectCountRef.current = updatedProjects.length;

      return updatedProjects;
    });
    
    // Add success alert
    actions.addAlert({
      title: "Success",
      message: "Project deleted successfully",
      variant: "success"
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    
    // Add error alert
    actions.addAlert({
      title: "Error",
      variant: "error",
      message: `Failed to delete project: ${error.message}`,
    });
  }
};



  

  function formatDate(dateString) {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    };
    const date = new Date(dateString);
    return date.toLocaleString('en-US', options);
  }

  const fetchAssociatedProjectsAndDetails = useCallback(async (objectType) => {
    console.log("Fetching projects");
    if (!context.crm.objectId) {
      console.error("No object ID available to fetch associated projects.");
      setIsLoading(false);
      return [];
    }
  
    try {
      const associatedProjectsResponse = await runServerless({
        name: 'fetchProjects',
        parameters: {
          fromObjectId: context.crm.objectId,
          fromObjectType: objectType
        }
      });
  
      if (associatedProjectsResponse && associatedProjectsResponse.response && associatedProjectsResponse.response.body) {
        const projectsData = JSON.parse(associatedProjectsResponse.response.body);
        console.log("Fetched project data:", projectsData);
  
        if (projectsData && projectsData.results && projectsData.results.length > 0) {
          const uniqueProjectIds = new Set(projectsData.results.flatMap(p => p.to ? p.to.map(proj => proj.id) : []));
          
          const projectDetailsResponse = await runServerless({
            name: 'fetchProjectDetails',
            parameters: { objectIds: Array.from(uniqueProjectIds) }
          });
  
          if (projectDetailsResponse && projectDetailsResponse.response && projectDetailsResponse.response.body) {
            const projectDetails = JSON.parse(projectDetailsResponse.response.body);
  
            const uniqueDetailedProjects = new Map();
            projectsData.results.forEach(project => {
              project.to.forEach(p => {
                const detail = projectDetails.find(d => d.objectId === p.id);
                if (detail) {
                  uniqueDetailedProjects.set(p.id, { ...p, ...detail });
                } else {
                  uniqueDetailedProjects.set(p.id, p);
                }
              });
            });
  
            const detailedProjects = Array.from(uniqueDetailedProjects.values());
            detailedProjects.sort((a, b) => new Date(b.hs_lastmodifieddate) - new Date(a.hs_lastmodifieddate));
  
            // Update state
            setProjects(detailedProjects);
            const totalPages = Math.ceil(detailedProjects.length / RECORDS_PER_PAGE);
            setTotalPages(totalPages);
            setIsLoading(false);
            setDataFetched(true);
  
            // Return the detailed projects
            return detailedProjects;
          }
        }
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch associated projects:", error);
      setIsLoading(false);
      setDataFetched(true);
      actions.addAlert({
        title: "API Error",
        variant: "error",
        message: `Error fetching associated projects: ${error.message || 'No error message available'}`
      });
      return [];
    }
  }, [context.crm.objectId, runServerless, actions]);
  
  

  const editClick = async (projectId, fileId, encodedoptions) => {
    try {
      const userId = context.user.id;
      const contactId = context.crm.objectId;
  
      let editorinnerurl = `https://app.marq.com/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedoptions}&creatorid=${userId}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&fileid=${fileId}`;
      let editoriframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(editorinnerurl);
  
      setIframeUrl(editoriframeSrc);
      actions.openIframeModal({
        uri: editoriframeSrc,
        height: 1500,
        width: 1500,
        title: "Marq Editor",
      });
      setIframeOpen(true);
    } catch (error) {
      console.error('Error in editClick:', error);
    }
  };
  

  const sendEmail = async (project) => {
    try {
      const response = await runServerlessFunction({
        name: 'generateEmailContent',
        parameters: { project }
      });
  
      if (response && response.emailContent) {
        const emailContent = response.emailContent;
        // Open the email composition window with the generated content
        actions.openEmailComposeWindow({
          to: project.contactEmail,
          subject: `Details for project ${project.name}`,
          body: emailContent
        });
      }
    } catch (error) {
      console.error('Failed to generate email content:', error);
    }
  };

  const extractFiltersFromProperties = (fieldsArray, filtersArray, properties) => {
    let filters = [];
    
    fieldsArray.forEach((field, index) => {
      if (properties[field]) {
        const fieldValue = properties[field];
        const filterValue = filtersArray[index];
        filters.push({ name: filterValue, value: fieldValue });
      }
    });

    // console.log("Extracted Filters:", filters);

  
    return filters;
  };
  

  const handleOnSort = (fieldName, currentDirection) => {
    let newDirection = 'descending';
    if (currentDirection === 'ascending') {
      newDirection = 'descending';
    } else if (currentDirection === 'descending') {
      newDirection = 'none';
    } else {
      newDirection = 'ascending';
    }

    setSortConfig({ field: fieldName, direction: newDirection });

    const sortedProjects = [...projects];
    if (newDirection !== 'none') {
      sortedProjects.sort((a, b) => {
        if (a[fieldName] < b[fieldName]) {
          return newDirection === 'ascending' ? -1 : 1;
        }
        if (a[fieldName] > b[fieldName]) {
          return newDirection === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    setProjects(sortedProjects);
  };




  const refreshProjects = async () => {
    console.log("Calling refresh projects");
  
    if (objectType) {
      // Get previous project count from ref
      const previousProjectCount = previousProjectCountRef.current;
      console.log(`Previous project count: ${previousProjectCount}`);
  
      // Fetch the new projects
      const fetchedProjects = await fetchAssociatedProjectsAndDetails(objectType);
      console.log(`Fetched project count: ${fetchedProjects.length}`);
  
      // Check if new projects have been added
      if (fetchedProjects.length > previousProjectCount) {
        console.log("New projects detected, stopping polling");
        setShouldPollForProjects(false); // Stop polling
      } else {
        console.log("No new projects detected, continuing polling");
      }
    } else {
      console.log("Object type not detected");
    }
  };
  
  
  

  const setapi = async (userid, userEmail) => {
    try {
      const apiResponse = await runServerless({
        name: 'getApiKey'
      });
  
      if (apiResponse && apiResponse.response && apiResponse.response.body) {
        const body = JSON.parse(apiResponse.response.body);
        if (body && body.key) {
          const apiKey = body.key;
          setAPIkey(apiKey);
          // console.log("API Key loaded:", apiKey);
          const authorizationUrl = handleConnectToMarq(apiKey, userid, userEmail);  // Pass the API key, userid, and userEmail
          setauth(authorizationUrl);
          return apiKey;  // Return the API key
        } else {
          console.error("No API key found in response.");
          actions.addAlert({
            title: "Error",
            variant: "error",
            message: "Failed to retrieve API key."
          });
        }
      } else {
        console.error("API response was invalid or missing.");
        actions.addAlert({
          title: "Error",
          variant: "error",
          message: "Invalid API response."
        });
      }
    } catch (error) {
      console.error("Error retrieving API key:", error);
      actions.addAlert({
        title: "Error",
        variant: "error",
        message: "Failed to retrieve API key."
      });
    }
    return null;  // Return null if the API key was not retrieved
  };


  const handleClick = async (template) => {

    let iframeSrc = 'https://info.marq.com/loading';


     setIframeUrl(iframeSrc);
     actions.openIframeModal({
       uri: iframeSrc,
       height: 1500,
       width: 1500,
       title: "Marq",
     });
     setIframeOpen(true);
   

    try {
      console.log("Template clicked:", template.id, template.title);
      const userId = context.user.id;

    

if (!currentRefreshToken) {
      try {
        console.log("Polling for refresh token...");
        const createusertable = await runServerless({
          name: 'marqouathhandler',
          parameters: { userID: userId }
        });
        console.log("Response from serverless function:", createusertable); 
    
        if (createusertable?.response?.body) {
          console.log("Received response from serverless function:", createusertable);
    
          // Access row and values properly
          const responseBody = JSON.parse(createusertable.response.body);
          const userData = responseBody?.row?.values || {};
          
          console.log("userData:", userData);
    
          currentRefreshToken = userData?.refreshToken || null;
  
          console.log("currentRefreshToken:", currentRefreshToken);
    
          if (currentRefreshToken && currentRefreshToken !== 'null' && currentRefreshToken !== '') {
            console.log("Refresh token found:", currentRefreshToken);
          } else {
            console.log("Refresh token not found");
            setShowTemplates(false);
          }
        } else {
          console.log("No response body from serverless function.");
        }
      } catch (error) {
        console.error("Error while polling for refresh token:", error);
      }
    }


      const userid = context.user.id;
      const clientid = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
      const clientsecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';
      const marquserId = marquserid; 
      const marqaccountid = "163559625"; 
      const recordid = context.crm?.objectId?.toString() || '';
      const templateid = template?.id || ''; // Fetching template ID from the clicked template
      const templatetitle = template?.title || ''; // Fetching template title from the clicked template
      console.log(`marquserid: ${marquserId}`)


      const dynamicValue = (configData.value && context.crm.properties && configData.value in context.crm.properties)
        ? context.crm.properties[configData.value]
        : null;

      const contactId = context.crm.objectId;

      const enabledFeatures = configData.enabledFeatures?.map(feature => feature.name) || ["share"];
      const fileTypes = configData.fileTypes?.map(fileType => fileType.name) || ["pdf"];
      const showTabs = configData.showTabs?.map(tab => tab.name) || ["templates"];
      const configType = configData.configType?.name || "single";
      const dataSetType = configData.dataSetType?.name || "custom";
      const dataSetId = configData.dataSetId || `HB.${objectType}`;
      const key = configData.key || "id";
      // console.log("handleClick parameters:", { refresh_token, clientid, clientsecret, marquserId, recordid, templateid, templatetitle, marqaccountid, dataSetId });



      const encodedOptions = encodeURIComponent(btoa(JSON.stringify({
        enabledFeatures,
        fileTypes,
        showTabs,
      })));
  
      let importData = '';
      if (dataSetType === 'property listing') {
        importData = `propertyId=${dynamicValue || context.crm.objectId}`;
      } else if (dataSetType === 'custom') {
        importData = `dataSetId=${dataSetId}&key=${key}&value=${dynamicValue || context.crm.objectId}`;
      }
  
      const hasImportData = dataSetType !== 'none' && importData;
  
      // Step 1: Call the createProject serverless function to create a new project and get the project ID
      const createProjectResponse = await runServerless({
        name: 'createProject',
        parameters: {
          refresh_token: currentRefreshToken,
          clientid: clientid,                  // Pass client ID
          clientsecret: clientsecret,          // Pass client secret
          marquserId: marquserId,                      // Pass user ID
          recordid: recordid,                  // Pass CRM record ID
          templateid: templateid,              // Pass template ID
          templatetitle: templatetitle,        // Pass template title
          marqaccountid: marqaccountid,
          dataSetId: dataSetId
        }
  
      });


  
      // Step 2: Retrieve the projectId from the createProject response
      if (createProjectResponse && createProjectResponse.response && createProjectResponse.response.body) {
        const projectData = JSON.parse(createProjectResponse.response.body);
        console.log("Project created:", projectData);
  
        const projectId = projectData.documentid; // Get the project ID from the response
        console.log("Created Project ID:", projectId);

        currentRefreshToken = projectData.new_refresh_token
        console.log("refresh_token after project is created: ", currentRefreshToken)
  
        // // Step 3: Fetch associated projects and check if they are linked to this projectId
        // const associatedProjectsResponse = await runServerless({
        //   name: 'fetchProjects',
        //   parameters: {
        //     fromObjectId: context.crm.objectId,
        //     fromObjectType: objectType
        //   }
        // });
  
        // if (associatedProjectsResponse && associatedProjectsResponse.response && associatedProjectsResponse.response.body) {
        //   const projectsData = JSON.parse(associatedProjectsResponse.response.body);
        //   // console.log("Fetched project data:", projectsData);
  
        //   if (projectsData && projectsData.results && projectsData.results.length > 0) {
        //     const uniqueProjectIds = new Set(projectsData.results.flatMap(p => p.to ? p.to.map(proj => proj.id) : []));
  
        //     // Fetch project details using the unique project IDs
        //     const projectDetailsResponse = await runServerless({
        //       name: 'fetchProjectDetails',
        //       parameters: { objectIds: Array.from(uniqueProjectIds) }
        //     });
  
        //     if (projectDetailsResponse && projectDetailsResponse.response && projectDetailsResponse.response.body) {
        //       const projectDetails = JSON.parse(projectDetailsResponse.response.body);
        //       // console.log("Fetched project details:", projectDetails);
  
        //       const associatedProjectId = projectDetails[0].projectid; // Assuming the first result is the relevant one
        //       // console.log("Associated Project ID:", associatedProjectId);
  
              // Step 4: Now proceed with the iframe URL creation using projectId and other necessary details

              setIframeLoading(false);
              if(!projectId) {
                currentRefreshToken = '';
                setShowTemplates(false);
              actions.addAlert({
                title: "Error with creating project",
                variant: "danger",
                message: `There was an error with creating the project. Please try connecting to Marq again`
              });

              try {
                const updateResult = await runServerless({
                  name: 'updateUserRefresh',
                  parameters: {
                    userID: userid,
                    newrefreshtoken: currentRefreshToken
                  }
                });
              } catch (updateError) {
                console.error("Error occurred while trying to update HubDB:", updateError);
              }

              actions.closeIframeModal(); 
              setIframeOpen(false);

                return

              }


                const baseInnerUrl = `https://app.marq.com/documents/showIframedEditor/${projectId}/0?embeddedOptions=${encodedOptions}&creatorid=${userid}&contactid=${contactId}&apikey=${apiKey}&objecttype=${objectType}&dealstage=${stageName}&templateid=${template.id}`;
                const innerurl = hasImportData ? `${baseInnerUrl}&${importData}` : baseInnerUrl;
                iframeSrc = 'https://info.marq.com/marqembed?iframeUrl=' + encodeURIComponent(innerurl);
              
  
              // Step 5: Open the iframe with the generated URL
              setIframeUrl(iframeSrc);


              setIframeUrl(iframeSrc);
              actions.openIframeModal({
                uri: iframeSrc,
                height: 1500,
                width: 1500,
                title: "Marq",
                onClose: () => {
                  console.log("Iframe has been closed!"); 
                  setIframeOpen(false);  // Set the state to closed
                  refreshProjects();  // Automatically trigger your recheck logic when the iframe closes
                },
              });
              setShouldPollForProjects(true);

            } else {
              console.error("Failed to fetch project details or empty response");
            }

            try {
              const updateResult = await runServerless({
                name: 'updateUserRefresh',
                parameters: {
                  userID: userid,
                  newrefreshtoken: currentRefreshToken,
                }
              });
            } catch (updateError) {
              console.error("Error occurred while trying to update HubDB:", updateError);
            }

    //       } else {
    //         console.error("Failed to fetch associated projects: Empty results array");
    //       }
    //     } else {
    //       console.error("Failed to fetch associated projects.");
    //     }
    //   } else {
    //     console.error("Failed to create project or empty response.");
    //   }
  
 } 
    catch (error) {
      console.error('Error in handleClick:', error);

      actions.closeIframeModal(); 
      setIframeOpen(false);
      setShouldPollForProjects(false);
    }
  };
  

  
  
  const startPollingForRefreshToken = () => {
    setIsLoading(true);
    setIsPolling(true); // Start polling when the button is clicked
  };
  
  const pollForRefreshToken = async () => {
    console.log("Attempting poll");

    try {
      console.log("Polling for refresh token...");
      const userId = context.user.id;
      const createusertable = await runServerless({
        name: 'marqouathhandler',
        parameters: { userID: userId }
      });
      console.log("Response from serverless function:", createusertable); 
  
      if (createusertable?.response?.body) {
        console.log("Received response from serverless function:", createusertable);
  
        // Access row and values properly
        const responseBody = JSON.parse(createusertable.response.body);
        const userData = responseBody?.row?.values || {};
        
        console.log("userData:", userData);
  
        currentRefreshToken = userData?.refreshToken || null;

        console.log("currentRefreshToken:", currentRefreshToken);
  
        if (currentRefreshToken && currentRefreshToken !== 'null' && currentRefreshToken !== '') {
          console.log("Refresh token found:", currentRefreshToken);
          setIsPolling(false); // Stop polling
          fetchPropertiesAndLoadConfig(objectType);
        } else {
          console.log("Refresh token not found yet, continuing to poll...");
          setShowTemplates(false);
        }
      } else {
        console.log("No response body from serverless function.");
      }
    } catch (error) {
      console.error("Error while polling for refresh token:", error);
    }
  };
  
  
  useEffect(() => {
    let pollInterval;
  
    if (isPolling) {
      console.log("Starting to poll for refresh token every 5 seconds.");
      pollInterval = setInterval(pollForRefreshToken, 5000); // Poll every 5 seconds
    }
  
    return () => {
      console.log("Stopping the polling for refresh token.");
      clearInterval(pollInterval); // Clean up interval when component unmounts or polling stops
    };
  }, [isPolling]);
  
  useEffect(() => {
    if (shouldPollForProjects) {
        const pollingForProjects = async () => {
            console.log("Polling for projects");

            // Only consider previous project count if sync has happened
            if (hasSyncedOnce) {
                const previousProjectCount = previousProjectCountRef.current;
                console.log("Previous project count:", previousProjectCount);
            }

            await refreshProjects(); // Fetch new projects

            const fetchedProjectCount = projects.length;
            console.log("Fetched project count:", fetchedProjectCount);

            // Handle first sync
            if (!hasSyncedOnce) {
                console.log("First sync completed, setting previous project count");
                previousProjectCountRef.current = fetchedProjectCount;
                setHasSyncedOnce(true);
            } else if (fetchedProjectCount > previousProjectCountRef.current) {
                console.log("New projects detected, stopping polling");
                setShouldPollForProjects(false); // Stop polling if new projects are found
            } else {
                console.log("No new projects detected, continuing polling");
                previousProjectCountRef.current = fetchedProjectCount;
                pollingTimerRef.current = setTimeout(pollingForProjects, 20000); // Continue polling every 20 seconds
            }
        };

        // Clear any existing timer before starting a new one
        if (pollingTimerRef.current) {
            clearTimeout(pollingTimerRef.current);
        }

        // Start polling
        pollingForProjects();

        // Cleanup to stop polling when unmounted or when polling stops
        return () => {
            if (pollingTimerRef.current) {
                clearTimeout(pollingTimerRef.current);
            }
            setShouldPollForProjects(false);
        };
    }
}, [shouldPollForProjects, refreshProjects, hasSyncedOnce, projects.length]);


  
  
  

  useEffect(() => {
    fetchObjectType();
  }, [context.crm.objectTypeId, runServerless]);
  

  const handleSearch = useCallback((input) => {
    let searchValue = '';
    if (input && input.target) {
      searchValue = input.target.value;
    } else if (input) {
      searchValue = String(input);
    } else {
      console.error('Unexpected input:', input);
    }
  
    setSearchTerm(searchValue);
  
    if (searchValue.trim() === '') {
      setFilteredTemplates(initialFilteredTemplates); // Reset to initially filtered templates
      setTitle('Relevant Content');
    } else {
      setTitle('Search Results');
    }
  }, [initialFilteredTemplates]);
  
  useEffect(() => {
    if (searchTerm.trim() !== '') {
      const delayDebounceFn = setTimeout(() => {
        const lowerCaseSearchTerm = searchTerm.toLowerCase();


        const searchResults = fulltemplatelist.filter(template =>
          template?.title?.toLowerCase().includes(lowerCaseSearchTerm)
        );
   
  
        // Combine search results with initially filtered templates
        setFilteredTemplates([...searchResults]);
        setCurrentPage(1); // Reset to first page on search
      }, 300);
  
      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchTerm, templates, initialFilteredTemplates]);
  


useEffect(() => {
  const pages = Math.ceil(filteredTemplates.length / RECORDS_PER_PAGE);
  setTotalPages(pages);
}, [filteredTemplates]);
 

const handlePageChange = (pageNumber) => {
  if (pageNumber >= 1 && pageNumber <= totalPages) {
    setCurrentPage(pageNumber);
  }
};


const paginatedTemplates = filteredTemplates.slice(
  (currentPage - 1) * RECORDS_PER_PAGE,
  currentPage * RECORDS_PER_PAGE
);

const initialize = async () => {
  if (!hasInitialized.current && objectType) {
    hasInitialized.current = true;

    fetchPropertiesAndLoadConfig(objectType);
    fetchAssociatedProjectsAndDetails(objectType);

    // Fetch the userid and userEmail from context
    const userid = context.user.id;
    const userEmail = context.user.email; // Assuming context provides the user's email here

    // Fetch the API key and pass the userid and userEmail
    const apiKey = await setapi(userid, userEmail);
    setAPIkey(apiKey);

    // Fetch Marq user data and update refresh token if necessary
    const createusertable = await runServerless({
      name: 'marqouathhandler',
      parameters: { userID: userid }
    });

    if (createusertable?.response?.body) {
      const userData = JSON.parse(createusertable.response.body).values || {};
      const currentRefreshToken = userData.refreshToken;
      if (currentRefreshToken) {
        showTemplates(true);
      }
    } else {
      console.error("Failed to create or fetch user table.");
    }

  } else if (
    hasInitialized.current &&
    fieldsArray.length > 0 &&
    filtersArray.length > 0 &&
    Object.keys(crmProperties).length > 0
  ) {
    filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
  }
};

// const initialize = async () => {
//   if (!hasInitialized.current && objectType) {
//     hasInitialized.current = true;

//     fetchPropertiesAndLoadConfig(objectType);
//     fetchAssociatedProjectsAndDetails(objectType);

//     // Fetch the userid and userEmail from context
//     const userid = context.user.id;
//     const userEmail = context.user.email; // Assuming context provides the user's email here

//     // Fetch the API key and pass the userid and userEmail
//     const apiKey = await setapi(userid, userEmail);
//     setAPIkey(apiKey);

//   } else if (
//     hasInitialized.current &&
//     fieldsArray.length > 0 &&
//     filtersArray.length > 0 &&
//     Object.keys(crmProperties).length > 0
//   ) {
//     filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//   }
// };

useEffect(() => {
  fetchObjectType();
}, [context.crm.objectTypeId, runServerless]);

useEffect(() => {
  initialize();
}, [
  apiKey,
  accessToken,
  currentRefreshToken,
  context.crm.objectId,
  context.crm.objectTypeId,
  objectType,
  fieldsArray,
  filtersArray,
  crmProperties,
  fulltemplatelist,
  searchTerm
]);




// useEffect(() => {
//   actions.onMessage((message) => {
//     try {
//       const messageData = JSON.parse(message);
//       if (messageData.action === "DONE") {
//         console.log("Received DONE action from iframe");
//         refreshProjects(); 
//       }
//     } catch (error) {
//       console.error("Error parsing message data:", error);
//     }
//   });
// }, [actions]);


useEffect(() => {
    const handlePropertiesUpdate = (properties) => {
        if (!fieldsArray || fieldsArray.length === 0) {
            console.warn('fieldsArray is empty or undefined:', fieldsArray);
            return;
        }

        const hasRelevantChange = fieldsArray.some(field => properties[field]);

        if (hasRelevantChange) {
            if (context.crm.objectId && context.crm.objectTypeId) {
                fetchPropertiesAndLoadConfig(objectType);

                if (hasInitialized.current && filtersArray.length > 0 && Object.keys(crmProperties).length > 0) {
                    filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
                }
            } 
        } 
    };

    if (fieldsArray && fieldsArray.length > 0) {
        actions.onCrmPropertiesUpdate(fieldsArray, handlePropertiesUpdate);
    } else {
        console.warn('fieldsArray is empty, no properties to watch.');
    }

    return () => {
        actions.onCrmPropertiesUpdate([], null);
    };
}, [context.crm.objectId, context.crm.objectTypeId, objectType, fieldsArray, filtersArray, crmProperties, fulltemplatelist, searchTerm]);


// useEffect(() => {
//   window.updateTokens = (newAccessToken, newRefreshToken) => {
//       setAccessToken(newAccessToken);
//       setRefreshToken(newRefreshToken);
//   };
// }, []);

//   useEffect(() => {
//     const initialize = async () => {
//       if (!hasInitialized.current && objectType) {
//         hasInitialized.current = true;
//         const apiKey = await setapi();  // Wait for setapi() to complete
//         console.log(`This is the API Key: ${apiKey}`);  // Log the API Key
//         fetchPropertiesAndLoadConfig(objectType);
//         fetchAssociatedProjectsAndDetails(objectType);
//       } else if (
//         hasInitialized.current &&
//         fieldsArray.length > 0 &&
//         filtersArray.length > 0 &&
//         Object.keys(crmProperties).length > 0
//       ) {
//         filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//       }
//     };
  
//     initialize();  // Call the async function
//   }, [
//     context.crm.objectId,
//     context.crm.objectTypeId,
//     objectType,
//     fieldsArray,
//     filtersArray,
//     crmProperties,
//     fulltemplatelist,
//     searchTerm
//   ]);

//   useEffect(() => {
//     const handlePropertiesUpdate = (properties) => {
//         if (!fieldsArray || fieldsArray.length === 0) {
//             console.warn('fieldsArray is empty or undefined:', fieldsArray);
//             return;
//         }

  

//         // Checking for relevant property changes
//         const hasRelevantChange = fieldsArray.some(field => properties[field]);

//         if (hasRelevantChange) {
//             if (context.crm.objectId && context.crm.objectTypeId) {
//                 fetchPropertiesAndLoadConfig(objectType);

//                 if (hasInitialized.current && filtersArray.length > 0 && Object.keys(crmProperties).length > 0) {
//                     filterTemplates(fulltemplatelist, searchTerm, fieldsArray, filtersArray, crmProperties);
//                 }
//             } else {
//             }
//         } else {
//         }
//     };

//     if (fieldsArray && fieldsArray.length > 0) {
//         actions.onCrmPropertiesUpdate(fieldsArray, handlePropertiesUpdate);
//     } else {
//         console.warn('fieldsArray is empty, no properties to watch.');
//     }

//     return () => {
//         actions.onCrmPropertiesUpdate([], null);
//     };
// }, [context.crm.objectId, context.crm.objectTypeId, objectType, fieldsArray, filtersArray, crmProperties, fulltemplatelist, searchTerm]);

{/* <Flex direction="row" align="start" gap="medium">
<Image
  alt="Marq logo"
  src={`https://cdn-cashy-static-assets.marq.com/app/webroot/img/logos/marq/MarqLogo183x50.svg`}
  preventDefault={true}
  width={100}
/>
</Flex> */}

{/* <Flex direction="column" align="start" gap="medium">
<Box flex={1}>
<Image
             alt="Marq logo"
             src={`https://cdn-cashy-static-assets.marq.com/app/webroot/img/logos/marq/MarqLogo183x50.svg`}
             preventDefault={true}
             width={100}
           />
           </Box>
           <Box>

           </Box>
</Flex> */}


const handleConnectToMarq = (apiKey, userid, userEmail) => {
  try {
    const metadataType = 'user'; // Customize this as needed
    const authorizationUrl = getAuthorizationUrl(metadataType, apiKey, userid, userEmail);  // Pass userid and userEmail

    if (!authorizationUrl) {
      throw new Error('Failed to generate authorization URL.');
    }

    return authorizationUrl; // Return the URL to be used in the href
  } catch (error) {
    console.error('Error during authorization process:', error.message);
    // You can handle errors here, but avoid using alert since it's not supported.
  }
};



function getAuthorizationUrl(metadataType, apiKey, userid, userEmail) {
  try {
    const clientId = 'wfcWQOnE4lEpKqjjML2IEHsxUqClm6JCij6QEXGa';
    const clientSecret = 'YiO9bZG7k1SY-TImMZQUsEmR8mISUdww2a1nBuAIWDC3PQIOgQ9Q44xM16x2tGd_cAQGtrtGx4e7sKJ0NFVX';
    const redirectUri = 'https://info.marq.com/crm-oauth-hubspot';

    const encodedRedirectUri = encodeURIComponent(redirectUri);

    // Create the state map that includes the API key, userId, email, and other details
    const stateMap = {
      apiKey: apiKey,
      metadataType: metadataType,
      clientId: clientId,
      clientSecret: clientSecret,
      redirectUri: encodedRedirectUri,
      userid: userid,       // Include the userId here
      email: userEmail      // Include the userEmail here
    };

    const stateJson = JSON.stringify(stateMap);
    const stateParam = btoa(stateJson); // Encode the state parameter

    let scopes;
    let authorizationUrl;

    // Determine the correct scopes and URL based on the metadata type
    if (metadataType.toLowerCase() === 'data') {
      scopes = 'project.templates project.content data-service.admin offline_access';
    } else {
      scopes = 'project.templates project.content offline_access';
    }

    const encodedScopes = encodeURIComponent(scopes);

    // Construct the authorization URL
    authorizationUrl = `https://app.marq.com/oauth2/authorize`
                     + `?response_type=code`
                     + `&client_id=${clientId}`
                     + `&client_secret=${clientSecret}`
                     + `&scope=${encodedScopes}`
                     + `&redirect_uri=${encodedRedirectUri}`
                     + `&state=${stateParam}`;

    return authorizationUrl;

  } catch (error) {
    console.error('Error generating authorization URL:', error.message);
    return null;
  }
}



if (iframeLoading || isLoading) {
  return (
    <Flex direction="column" gap="medium" align="center">
      <LoadingSpinner label="Loading projects..." layout="centered" />
    </Flex>
  );
} 

// if (!isLoading && !templateLink) {
//   return (
//     <EmptyState title="Failed to load templates" layout="vertical">
//       <Text>We couldn't load the templates. Please try reloading.</Text>
//       <Button variant="primary" onClick={fetchPropertiesAndLoadConfig}>
//         Reload Templates
//       </Button>
//     </EmptyState>
//   );
// }



if (showTemplates) {

return (
  <>
    <Form>
      <Flex direction="row" justify="center" gap="small">
        <Box flex={1}>
          <Input
            type="text"
            placeholder="⌕ Search all templates"
            value={searchTerm}
            onInput={handleSearch}
            style={{ width: '100%' }}
          />
        </Box>
      </Flex>

      <Divider />

      <Flex direction="column" align="start" gap="small">
        <Box />
        <Box>
          <Text format={{ fontWeight: 'bold' }}>{title}</Text>
        </Box>
      </Flex>
    </Form>

    <Table
      paginated
      page={currentPage}
      pageCount={totalPages}
      maxVisiblePageButtons={5}
      showButtonLabels
      showFirstLastButtons={false}
      onPageChange={handlePageChange}
    >
      <TableBody>
        {paginatedTemplates.map((template, index) => {
          const matchingProject = projects.find(
            project => project.originaltemplateid === template.id
          );

          return matchingProject ? (
            <TableRow key={matchingProject.objectId || index}>
              <TableCell>
                <Image
                  alt="File Preview"
                  src={`https://app.marq.com/documents/thumb/${matchingProject.projectid}/0/2048/NULL/400`}
                  onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}
                  preventDefault
                  width={100}
                />
              </TableCell>
              <TableCell>
                <Link
                  href="#"
                  onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}
                  preventDefault
                  variant="primary"
                >
                  {matchingProject.name}
                </Link>
              </TableCell>
              <TableCell>{formatDate(matchingProject.hs_lastmodifieddate)}</TableCell>
              <TableCell>
                <ButtonRow disableDropdown={false}>
                  <Button onClick={() => editClick(matchingProject.projectid, matchingProject.fileid, matchingProject.encodedoptions)}>
                    Open
                  </Button>
                  <CrmActionButton actionType="EXTERNAL_URL" actionContext={{ href: matchingProject.fileurl }} variant="secondary">
                    Copy Published URL
                  </CrmActionButton>
                  <CrmActionButton
                    actionType="SEND_EMAIL"
                    actionContext={{
                      objectTypeId: context.crm.objectTypeId,
                      objectId: context.crm.objectId,
                    }}
                    variant="secondary"
                  >
                    Send email
                  </CrmActionButton>
                  <Button variant="destructive" onClick={() => deleteRecord(matchingProject.objectId, 'projects')}>
                    Delete
                  </Button>
                </ButtonRow>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow key={template.id || index} onClick={() => setSelectedRow(selectedRow === index ? null : index)}>
              <TableCell>
                <Image
                  alt="Template Preview"
                  src={`https://app.marq.com/documents/thumb/${template.id}/0/2048/NULL/400`}
                  onClick={() => handleClick(template)}
                  preventDefault
                  width={100}
                />
              </TableCell>
              <TableCell>
                <Link
                  href="#"
                  onClick={() => handleClick(template)}
                  preventDefault
                  variant="primary"
                >
                  {template.title}
                </Link>
              </TableCell>
              <TableCell />
              <TableCell>
                <Button onClick={() => handleClick(template)}>Create with Marq</Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </>
);

} else {
  return (
    <Button
      href={authurl}
      variant="primary"
      size="med"
      type="button"
      onClick={startPollingForRefreshToken}
    >
      Connect to Marq
    </Button>
  );
}
}

export default Extension;